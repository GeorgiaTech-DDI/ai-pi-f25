import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";
import { Pinecone } from "@pinecone-database/pinecone";
import type { NextApiRequest, NextApiResponse } from "next";

// Initialize AWS SageMaker Runtime Client (for embeddings only)
const sagemakerRuntime = new SageMakerRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Initialize Pinecone Client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});
const index = pinecone.index(process.env.PINECONE_INDEX_NAME || "rag-embeddings");

// --- Embedding Function (using Sagemaker Embedding Endpoint) ---
async function embedDocs(docs: string[]): Promise<number[][]> {
  const params = {
    EndpointName: process.env.SAGEMAKER_EMBEDDING_ENDPOINT_NAME || "minilm-embedding",
    ContentType: "application/json",
    Body: JSON.stringify({ inputs: docs }),
  };

  try {
    const command = new InvokeEndpointCommand(params);
    const response = await sagemakerRuntime.send(command);
    const payload = new TextDecoder().decode(response.Body);
    const embeddings_raw = JSON.parse(payload);

    // Assuming the endpoint returns embeddings in a structure like [[...embeddings...]]
    // Adjust based on your actual endpoint response format
    const embeddings = embeddings_raw.vectors ? embeddings_raw.vectors : embeddings_raw;

    if (!Array.isArray(embeddings) || embeddings.length === 0 || !Array.isArray(embeddings[0])) {
      console.error("Unexpected embedding format from SageMaker:", embeddings_raw);
      throw new Error("Unexpected embedding format from SageMaker.");
    }

    // If the endpoint already returns sentence embeddings, just use them directly
    return embeddings;
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
function createPayload(question: string, contextStr: string) {
  const systemMessage = `You are a helpful AI assistant that answers questions based on the provided context.
If the context doesn't contain the answer, say "I can't find the answer in the context, but I think" and provide your best guess. If you don't know the answer, say "I don't know."
Be as concise and accurate as possible without repeating the question or context. Feel free to ignore the context if not relevant.
Answer in LESS than 100 words.`;

  const userPrompt = `CONTEXT:
${contextStr}

QUESTION:
${question}`;

  return {
    model: "unsloth/gemma-3-12b-it",
    messages: [
      {
        role: "system",
        content: systemMessage,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    stream: false,
    max_tokens: 250,
    temperature: 0.85,
  };
}

// --- RAG Query Function with Chutes API ---
async function ragQuery(question: string): Promise<[string, any[]]> {
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

    const queryVec = queryVecEmbeddings[0][0]; // Take the first (and hopefully only) embedding
    if (!Array.isArray(queryVec)) {
      // Double check embedding structure
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
    const payload = createPayload(question, contextStr);

    // Call the Chutes API
    const chutesResponse = await fetch("https://llm.chutes.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CHUTES_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!chutesResponse.ok) {
      const errorText = await chutesResponse.text();
      throw new Error(`Chutes API error: ${chutesResponse.status} - ${errorText}`);
    }

    const chutesData = await chutesResponse.json();

    // Extract the assistant's response
    let answerText = "";
    if (chutesData.choices && chutesData.choices.length > 0 && chutesData.choices[0].message) {
      answerText = chutesData.choices[0].message.content;
    } else {
      throw new Error("Unexpected response format from Chutes API");
    }

    // Clean up the response similar to the original code
    answerText = answerText.split("ANSWER")[0].trim();
    answerText = answerText.split("Human")[0].trim();
    answerText = answerText.split("[CLS]")[0].trim();
    answerText = answerText.split("[SEP]")[0].trim();
    answerText = answerText.split("(LESS")[0].trim();

    // Trim any trailing partial sentence
    const lastPeriodIndex = answerText.lastIndexOf(".");
    if (lastPeriodIndex !== -1 && lastPeriodIndex < answerText.length - 1) {
      answerText = answerText.substring(0, lastPeriodIndex + 1);
    }

    // Check for repeating sentences
    const sentences = answerText.split(". ");
    const uniqueSentences = new Set();
    const filteredSentences = sentences.filter((sentence: string) => {
      const normalized = sentence
        .trim()
        .toLowerCase()
        .replace(/[.?!]$/, "");
      if (uniqueSentences.has(normalized)) {
        return false;
      }
      uniqueSentences.add(normalized);
      return true;
    });
    answerText = filteredSentences.join(". ");

    return [answerText, contexts];
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

  // Format the history and current question for the model
  let formattedHistory = "";
  if (history.length > 0) {
    formattedHistory = history
      .map(
        (msg: { role: string; content: string }) =>
          `${msg.role === "user" ? "Human" : "Assistant"}: ${msg.content}`,
      )
      .join("\n\n");

    formattedHistory += "\n\n";
  }
  const fullPrompt = `${formattedHistory}Human: ${question}`;

  try {
    const [answer, contexts] = await ragQuery(fullPrompt);
    return res.status(200).json({ answer, contexts });
  } catch (error: unknown) {
    console.error("Error in Chutes RAG API:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
}
