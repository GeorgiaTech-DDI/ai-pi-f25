import { Pinecone } from "@pinecone-database/pinecone";
import type { NextApiRequest, NextApiResponse } from "next";

// Initialize Pinecone Client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});
const index = pinecone.index(process.env.PINECONE_INDEX_NAME || "rag-embeddings");

// --- Helper to check Ollama availability ---
async function isOllamaRunning(timeout = 500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    // Use Ollama's base endpoint for the health check
    const response = await fetch("http://localhost:11434/", {
      method: "GET", // Or HEAD
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    // Check for any successful response, adjust if specific status needed
    // Ollama root returns 200 OK with "Ollama is running"
    return response.ok;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.warn("Ollama health check timed out.");
    } else if (error.cause && error.cause.code === "ECONNREFUSED") {
      console.warn("Ollama connection refused. Server likely not running.");
    } else {
      console.warn("Ollama health check failed:", error.message);
    }
    return false;
  }
}

// --- Embedding Function (using Ollama or Sagemaker Embedding Endpoint) ---
async function embedDocs(docs: string[]): Promise<number[][]> {
  const ollamaUrl = "http://localhost:11434/v1/embeddings";
  const ollamaModel = "jeffh/intfloat-multilingual-e5-large:f16";
  const hfApiUrl = process.env.HF_API_URL;
  const hfApiKey = process.env.HF_API_KEY;
  const prefixedDocs = docs.map((doc) => `query: ${doc}`);
  try {
    const ollamaAvailable = await isOllamaRunning();

    if (ollamaAvailable) {
      console.log("Ollama is available. Using local embedding model.");
      const response = await fetch(ollamaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: prefixedDocs,
          model: ollamaModel,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Validate Ollama response structure
      // out["data"][0]["embedding"]
      if (!result.data || !Array.isArray(result.data)) {
        console.error("Unexpected embedding format from Ollama:", result);
        throw new Error("Unexpected embedding format from Ollama.");
      }

      // Extract embeddings
      const embeddings: number[][] = result.data.map((item: any) => {
        if (!item.embedding || !Array.isArray(item.embedding)) {
          console.error("Invalid embedding item from Ollama:", item);
          throw new Error("Invalid embedding item received from Ollama.");
        }
        return item.embedding;
      });

      if (embeddings.length !== docs.length) {
        throw new Error("Mismatch between number of documents and embeddings from Ollama.");
      }

      console.log(`Successfully generated ${embeddings.length} embeddings using Ollama.`);
      return embeddings;
    } else {
      console.log("Ollama not available. Using Hugging Face API for embeddings.");

      if (!hfApiUrl || !hfApiKey) {
        throw new Error("Ollama is unavailable and Hugging Face API URL or Key is not configured.");
      }

      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${hfApiKey}`,
        "Content-Type": "application/json",
      };
      const embeddings: number[][] = [];

      // Process documents one by one as the original code did for HF
      // Note: Some HF endpoints might support batching, but this follows the previous pattern.
      for (const prefixedDoc of prefixedDocs) {
        const response = await fetch(hfApiUrl, {
          method: "POST",
          headers: headers,
          body: JSON.stringify({ inputs: prefixedDoc }), // Send one prefixed doc at a time
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // The expected format from the provided Python code should be a vector
        if (!Array.isArray(result)) {
          console.error("Unexpected embedding format from Hugging Face:", result);
          throw new Error("Unexpected embedding format from Hugging Face.");
        }

        embeddings.push(result);
      }

      return embeddings;
    }
  } catch (error) {
    console.error("Error embedding documents:", error);
    throw error;
  }
}

// --- Construct Context Function ---
function constructContext(
  contexts: Array<{ text: string; filename: string }>,
  maxSectionLen = 5000,
) {
  let chosenSections: string[] = [];
  let chosenSectionsLen = 0;

  for (const context of contexts) {
    const formattedText = `[Source: ${context.filename}]\n${context.text.trim()}`;
    chosenSectionsLen += formattedText.length + 2; // +2 for separator
    if (chosenSectionsLen > maxSectionLen) {
      break;
    }
    chosenSections.push(formattedText);
  }
  const concatenatedDoc = chosenSections.join("\n\n");
  console.log(`Selected top ${chosenSections.length} document sections`);
  return concatenatedDoc;
}

// --- Create Payload Function for Chutes API ---
function createPayload(question: string, contextStr: string, conversationHistory: string = "") {
  const systemMessage = `You are a helpful AI assistant that answers questions based on the provided context.
If the context doesn't contain the answer, say "I can't find the answer in the context, but I think" and provide your best guess. If you don't know the answer, say "I don't know."
Be concise and accurate and do not repeat the question or context. Make sure you answer the question. Answer in LESS than 200 words.`;

  let userPrompt = `CONTEXT:
${contextStr}`;

  // Add conversation history if available
  if (conversationHistory) {
    userPrompt += `\n\nPREVIOUS CONVERSATION:
${conversationHistory}`;
  }

  userPrompt += `\n\nCURRENT QUESTION:
${question}`;

  return {
    messages: [
      {
        role: "user",
        content: `${systemMessage}\n\n${userPrompt}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.85,
  };
}

// --- RAG Query Function with Chutes API ---
async function ragQuery(
  question: string,
  conversationHistory: string = "",
): Promise<[string | ReadableStream<Uint8Array>, any[]]> {
  try {
    const queryVecEmbeddings = await embedDocs([question]); // Embed the question
    if (
      !queryVecEmbeddings ||
      !Array.isArray(queryVecEmbeddings) ||
      queryVecEmbeddings.length === 0 ||
      !Array.isArray(queryVecEmbeddings[0])
    ) {
      throw new Error("Failed to get valid embeddings for the question.");
    }

    const queryVec = queryVecEmbeddings[0][0]; // Take the first embedding
    if (!Array.isArray(queryVec)) {
      throw new Error("Unexpected embedding structure.");
    }

    const queryResult = await index.query({
      vector: queryVec,
      topK: 8,
      includeMetadata: true,
    });

    const contexts = queryResult.matches;
    // Create array of objects with text and filename
    const contextObjects = contexts
      .map((match) => {
        if (match.metadata?.text && match.metadata?.filename) {
          return {
            text: match.metadata.text,
            filename: match.metadata.filename,
          };
        }
        return null;
      })
      .filter((item): item is { text: string; filename: string } => item !== null);

    const contextStr = constructContext(contextObjects);

    // Include the conversation history in the context for the LLM
    const payload = createPayload(question, contextStr, conversationHistory);

    // Call the OpenRouter API
    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
        "HTTP-Referer": process.env.PUBLIC_SITE_URL || "https://matrixlab.gatech.edu",
        "X-Title": "Matrix Lab AI",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        model: "google/gemma-3-27b-it:free",
        stream: true, // Enable streaming
        provider: {
          order: ["Chutes"],
        },
      }),
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      throw new Error(`OpenRouter API error: ${openRouterResponse.status} - ${errorText}`);
    }
    console.log(`OpenRouter response received!`);

    // For streaming responses, return the stream directly
    return [openRouterResponse.body as ReadableStream<Uint8Array>, contexts];
  } catch (error) {
    console.error("Error in ragQuery:", error);
    throw error;
  }
}

// --- API Endpoint Handler ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { question, history = [] } = req.body;

  if (!question) {
    return res.status(400).json({ message: "Question is required" });
  }

  try {
    // Format the conversation history for the model
    let conversationHistory = "";
    if (history.length > 0) {
      conversationHistory = history
        .map(
          (msg: { role: string; content: string }) =>
            `${msg.role === "user" ? "Human" : "Assistant"}: ${msg.content}`,
        )
        .join("\n\n");
    }

    // Pass both the current question and conversation history to ragQuery
    const [streamOrString, contexts] = await ragQuery(question, conversationHistory);

    // If we got a stream back, pipe it to the client
    if (streamOrString instanceof ReadableStream) {
      // Set appropriate headers for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      console.log("Starting stream response");

      // Send contexts data as the first event
      res.write(`data: ${JSON.stringify({ type: "contexts", contexts })}\n\n`);

      // Use ReadableStream Web API directly instead of Node.js streams
      const reader = streamOrString.getReader();
      const textDecoder = new TextDecoder();

      let responseEnded = false;
      let buffer = ""; // Buffer to collect partial chunks

      // Setup response end handler
      req.on("close", () => {
        console.log("Request closed by client");
        responseEnded = true;
        reader.cancel();
        if (!res.writableEnded) {
          res.end();
        }
      });

      // Define process stream function before using it
      const processStream = async () => {
        try {
          let tokensReceived = 0;

          while (!responseEnded) {
            const { done, value } = await reader.read();

            if (done) {
              console.log("Stream reading complete");
              if (!responseEnded && !res.writableEnded) {
                res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
                res.end();
              }
              break;
            }

            if (!value || value.length === 0) {
              continue;
            }

            // Decode the chunk and add it to our buffer
            const chunk = textDecoder.decode(value, { stream: true });
            buffer += chunk;

            // Log raw chunk for debugging
            console.log(`Received chunk: ${chunk.length} bytes`);

            // Process any complete SSE messages in the buffer
            const lines = buffer.split("\n");
            // Keep the last line in the buffer if it's not complete
            buffer = lines.pop() || "";

            for (const line of lines) {
              // Process each line
              if (line.startsWith("data: ")) {
                const data = line.substring(6).trim();

                if (data === "[DONE]") {
                  console.log("Received [DONE] signal");
                  if (!responseEnded && !res.writableEnded) {
                    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
                  }
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  console.log("Parsed data:", JSON.stringify(parsed).substring(0, 400) + "...");

                  // Handle different streaming formats
                  let content = "";

                  // OpenRouter format
                  if (parsed.choices && parsed.choices.length > 0) {
                    // Different models might use different response formats
                    if (parsed.choices[0].delta && parsed.choices[0].delta.content) {
                      content = parsed.choices[0].delta.content;
                    } else if (parsed.choices[0].content) {
                      content = parsed.choices[0].content;
                    } else if (parsed.choices[0].text) {
                      content = parsed.choices[0].text;
                    } else if (parsed.choices[0].message && parsed.choices[0].message.content) {
                      content = parsed.choices[0].message.content;
                    }
                  }

                  // Also check for anthropic/claude format
                  if (parsed.completion) {
                    content = parsed.completion;
                  }

                  if (content) {
                    tokensReceived++;
                    if (!responseEnded && !res.writableEnded) {
                      console.log(`Sending token ${tokensReceived}: ${content}`);
                      res.write(`data: ${JSON.stringify({ type: "token", content })}\n\n`);
                    }
                  }
                } catch (e) {
                  console.error("Error parsing stream data:", e, "Raw data:", data);
                  // Just log the error but continue processing
                }
              }
            }
          }
        } catch (err) {
          console.error("Stream processing error:", err);
          if (!responseEnded && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`);
            res.end();
          }
        }
      };

      // Start processing the stream
      processStream().catch((err) => {
        console.error("Unhandled error in stream processing:", err);
        if (!responseEnded && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`);
          res.end();
        }
      });

      return;
    } else {
      // If not streaming (fallback), send the complete response
      return res.status(200).json({ answer: streamOrString, contexts });
    }
  } catch (error: unknown) {
    console.error("Error in API:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    // Only send an error response if headers haven't been sent already
    if (!res.headersSent) {
      return res.status(500).json({ message: "Internal server error", error: errorMessage });
    }
  }
}
