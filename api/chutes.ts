import { Pinecone } from "@pinecone-database/pinecone";
import type { NextApiRequest, NextApiResponse } from "next";
import { Embeddings } from "deepinfra";

// Types for conversation history management
interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  contexts?: any[]; // Store RAG contexts for this message
}

interface PrunedHistory {
  recentMessages: ConversationMessage[];
  summaryContext?: string;
  totalChars: number;
}

// Configuration for history management
const HISTORY_CONFIG = {
  MAX_RECENT_MESSAGES: 8, // Keep last 8 messages
  MAX_TOTAL_CHARS: 5000, // Maximum character limit for history
  MIN_RELEVANCE_SCORE: 0.3, // Minimum relevance score for keeping messages
  SUMMARY_THRESHOLD: 10, // Number of messages before summarization kicks in
};

// Conversation metrics tracking
interface ConversationMetrics {
  originalMessageCount: number;
  prunedMessageCount: number;
  totalCharsOriginal: number;
  totalCharsPruned: number;
  compressionRatio: number;
  hasSummary: boolean;
  shouldSuggestRestart: boolean;
}

// Initialize Pinecone Client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});
const index = pinecone.index(process.env.PINECONE_INDEX_NAME || "rag-embeddings");

// --- Conversation History Management Functions ---

/**
 * Calculate relevance score between a message and the current question
 */
function calculateRelevance(message: ConversationMessage, question: string): number {
  const messageWords = message.content.toLowerCase().split(/\s+/);
  const questionWords = question.toLowerCase().split(/\s+/);

  const overlap = messageWords.filter((word) =>
    questionWords.some((qWord) => qWord.includes(word) || word.includes(qWord)),
  ).length;

  return overlap / Math.max(messageWords.length, questionWords.length);
}

/**
 * Summarize old conversation context into a compact form
 */
function summarizeOldContext(messages: ConversationMessage[]): string {
  if (messages.length === 0) return "";

  const topics = new Set<string>();
  const keyPhrases: string[] = [];

  messages.forEach((msg) => {
    // Extract key phrases (simple heuristic: words longer than 5 chars)
    const words = msg.content.split(/\s+/);
    words.forEach((word) => {
      const cleaned = word.replace(/[^\w]/g, "").toLowerCase();
      if (cleaned.length > 5 && !topics.has(cleaned)) {
        topics.add(cleaned);
        keyPhrases.push(cleaned);
      }
    });
  });

  if (keyPhrases.length === 0) return "";

  return `PREVIOUS TOPICS: ${keyPhrases.slice(0, 8).join(", ")}`;
}

/**
 * Calculate conversation metrics for monitoring
 */
function calculateConversationMetrics(
  originalMessages: ConversationMessage[],
  prunedHistory: PrunedHistory,
): ConversationMetrics {
  const originalChars = originalMessages.reduce((sum, msg) => sum + msg.content.length, 0);
  const compressionRatio = originalChars > 0 ? prunedHistory.totalChars / originalChars : 1;

  // Suggest restart if conversation is getting too long or heavily compressed
  const shouldSuggestRestart =
    originalMessages.length > 30 || compressionRatio < 0.3 || originalChars > 8000;

  return {
    originalMessageCount: originalMessages.length,
    prunedMessageCount: prunedHistory.recentMessages.length,
    totalCharsOriginal: originalChars,
    totalCharsPruned: prunedHistory.totalChars,
    compressionRatio,
    hasSummary: !!prunedHistory.summaryContext,
    shouldSuggestRestart,
  };
}

/**
 * Prune conversation history intelligently
 */
function pruneConversationHistory(
  messages: ConversationMessage[],
  currentQuestion: string,
): PrunedHistory {
  if (messages.length === 0) {
    return { recentMessages: [], totalChars: 0 };
  }

  // Always keep the most recent messages
  const recentMessages = messages.slice(-HISTORY_CONFIG.MAX_RECENT_MESSAGES);

  // If we're under the character limit, return as is
  let totalChars = recentMessages.reduce((sum, msg) => sum + msg.content.length, 0);

  if (
    totalChars <= HISTORY_CONFIG.MAX_TOTAL_CHARS &&
    messages.length <= HISTORY_CONFIG.SUMMARY_THRESHOLD
  ) {
    return { recentMessages, totalChars };
  }

  // If we have too many messages, create a summary of older ones
  let finalMessages = recentMessages;
  let summaryContext: string | undefined;

  if (messages.length > HISTORY_CONFIG.SUMMARY_THRESHOLD) {
    const oldMessages = messages.slice(0, -HISTORY_CONFIG.MAX_RECENT_MESSAGES);
    summaryContext = summarizeOldContext(oldMessages);
  }

  // If still over character limit, trim from the beginning of recent messages
  while (totalChars > HISTORY_CONFIG.MAX_TOTAL_CHARS && finalMessages.length > 2) {
    const removed = finalMessages.shift();
    if (removed) {
      totalChars -= removed.content.length;
    }
  }

  return {
    recentMessages: finalMessages,
    summaryContext,
    totalChars: totalChars + (summaryContext?.length || 0),
  };
}

/**
 * Format pruned history for the model
 */
function formatHistoryForModel(prunedHistory: PrunedHistory): string {
  let formatted = "";

  if (prunedHistory.summaryContext) {
    formatted += `${prunedHistory.summaryContext}\n\n`;
  }

  if (prunedHistory.recentMessages.length > 0) {
    formatted += "Previous conversation:\n";
    // Filter out any context-related content and format as role-based conversation
    const cleanMessages = prunedHistory.recentMessages
      .filter((msg) => {
        // Skip messages that are primarily context content
        const content = msg.content.toLowerCase();
        if (
          content.includes("context for current question:") ||
          content.includes("invention studio context:")
        ) {
          return false;
        }

        return true;
      })
      .map((msg) => {
        // Clean content to remove any embedded context from previous interactions
        let content = msg.content;

        // Remove context sections that might have been stored from previous responses
        content = content.replace(/CONTEXT FOR CURRENT QUESTION:[\s\S]*?(?=\n\n|$)/g, "").trim();
        content = content.replace(/Previous conversation:[\s\S]*?Current question:/g, "").trim();
        content = content.replace(/INVENTION STUDIO CONTEXT:[\s\S]*?(?=\n\n|$)/g, "").trim();

        return `${msg.role === "user" ? "User" : "Assistant"}: ${content}`;
      })
      .filter((msg) => msg.length > (msg.startsWith("User: ") ? 6 : 11)); // Filter out empty messages

    formatted += cleanMessages.join("\n\n");
  }

  return formatted;
}

/**
 * Extract key terms and context from conversation for better embeddings
 */
function extractEmbeddingContext(conversationHistory: string, currentQuestion: string): string {
  if (!conversationHistory) return currentQuestion;

  // Extract technical terms and important concepts
  const lines = conversationHistory.split("\n");
  const userMessages = lines
    .filter((line) => line.startsWith("user:"))
    .map((line) => line.replace("user:", "").trim());

  // Get the last 2 user questions for context
  const recentQuestions = userMessages.slice(-2);

  // Extract key terms (words longer than 4 chars, technical terms)
  const keyTerms = new Set<string>();
  const technicalPattern = /\b[A-Z][a-z]*(?:[A-Z][a-z]*)*\b|\b\w*(?:ing|tion|ment|ness|ity)\b/g;

  recentQuestions.forEach((question) => {
    // Add technical terms
    const matches = question.match(technicalPattern) || [];
    matches.forEach((term) => {
      if (term.length > 4) keyTerms.add(term.toLowerCase());
    });

    // Add important nouns and verbs
    const words = question.split(/\s+/);
    words.forEach((word) => {
      const cleaned = word.replace(/[^\w]/g, "").toLowerCase();
      if (
        cleaned.length > 4 &&
        !["that", "this", "with", "from", "they", "them", "were", "have", "been"].includes(cleaned)
      ) {
        keyTerms.add(cleaned);
      }
    });
  });

  // Combine key terms with current question
  const contextTerms = Array.from(keyTerms).slice(0, 5).join(" ");
  return contextTerms ? `${contextTerms} ${currentQuestion}` : currentQuestion;
}

/**
 * Optimize conversation history after response generation
 * This can be called in the background to prepare for the next request
 */
function optimizeHistoryForNextRequest(
  originalHistory: ConversationMessage[],
  currentQuestion: string,
  assistantResponse: string,
  contexts?: any[],
): ConversationMessage[] {
  // Add the new exchange to history
  const updatedHistory = [
    ...originalHistory,
    {
      role: "user" as const,
      content: currentQuestion,
      timestamp: Date.now(),
    },
    {
      role: "assistant" as const,
      content: assistantResponse,
      timestamp: Date.now(),
      contexts: contexts, // Store contexts with the assistant response
    },
  ];

  // Apply intelligent pruning for next request
  const pruned = pruneConversationHistory(updatedHistory, "");

  return pruned.recentMessages;
}

/**
 * Perform background optimization of conversation history
 * Called asynchronously after response is sent
 */
async function performBackgroundOptimization(
  originalMessages: ConversationMessage[],
  question: string,
  response: string,
  contexts?: any[],
): Promise<void> {
  try {
    // Optimize history for future requests
    const optimizedHistory = optimizeHistoryForNextRequest(
      originalMessages,
      question,
      response,
      contexts,
    );

    // Log optimization results
    const originalChars = originalMessages.reduce((sum, msg) => sum + msg.content.length, 0);
    const optimizedChars = optimizedHistory.reduce((sum, msg) => sum + msg.content.length, 0);

    console.log(
      `Background optimization completed: ${originalMessages.length} -> ${optimizedHistory.length} messages, ` +
        `${originalChars} -> ${optimizedChars} chars saved for next request`,
    );

    // Here you could save the optimized history to a cache/database if needed
    // await saveOptimizedHistory(userId, optimizedHistory);
  } catch (error) {
    console.error("Background optimization failed:", error);
  }
}

/**
 * Utility function to assess conversation health for monitoring/debugging
 */
function assessConversationHealth(messages: ConversationMessage[]): {
  status: "healthy" | "warning" | "critical";
  recommendations: string[];
  stats: ConversationMetrics;
} {
  if (messages.length === 0) {
    return {
      status: "healthy",
      recommendations: [],
      stats: {
        originalMessageCount: 0,
        prunedMessageCount: 0,
        totalCharsOriginal: 0,
        totalCharsPruned: 0,
        compressionRatio: 1,
        hasSummary: false,
        shouldSuggestRestart: false,
      },
    };
  }

  const prunedHistory = pruneConversationHistory(messages, "");
  const stats = calculateConversationMetrics(messages, prunedHistory);

  const recommendations: string[] = [];
  let status: "healthy" | "warning" | "critical" = "healthy";

  // Assess conversation health
  if (stats.originalMessageCount > 50) {
    status = "critical";
    recommendations.push("Consider starting a fresh conversation");
  } else if (stats.originalMessageCount > 30) {
    status = "warning";
    recommendations.push("Conversation is getting long, consider summarizing");
  }

  if (stats.compressionRatio < 0.2) {
    status = "critical";
    recommendations.push("Heavy compression detected, context may be lost");
  } else if (stats.compressionRatio < 0.5) {
    if (status === "healthy") status = "warning";
    recommendations.push("Moderate compression applied to conversation");
  }

  if (stats.totalCharsOriginal > 10000) {
    if (status === "healthy") status = "warning";
    recommendations.push("Large conversation size may impact performance");
  }

  return { status, recommendations, stats };
}

// --- Helper to check Ollama availability ---
async function isOllamaRunning(timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    // Use Ollama's base endpoint for the health check
    const response = await fetch(`${process.env.OLLAMA_URL}/api/tags`, {
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
  const ollamaUrl = `${process.env.OLLAMA_URL}/v1/embeddings`;
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
    } else if (process.env.DEEPINFRA_API_KEY) {
      console.log("Ollama not available. Using DeepInfra API for embeddings.");

      const client = new Embeddings(
        "intfloat/multilingual-e5-large",
        process.env.DEEPINFRA_API_KEY,
      );
      const body = { inputs: docs };
      const output = await client.generate(body);
      const embeddings = output.embeddings;
      if (embeddings.length !== docs.length) {
        throw new Error("Mismatch between number of documents and embeddings from Ollama.");
      }
      return embeddings;
    } else {
      console.log("Ollama/Together not available. Using Hugging Face API for embeddings.");

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
  console.log(`Doc Length: ${concatenatedDoc.length}`);
  console.log(`Concatenated Doc: ${concatenatedDoc}`);
  return concatenatedDoc;
}

// --- Create Payload Function for Chutes API ---
function createPayload(question: string, contextStr: string, conversationHistory: string = "") {
  const messages: Array<{ role: string; content: string }> = [];

  // System message without embedding context directly
  const systemMessage = `You are AI PI, a helpful assistant for the Invention Studio at Georgia Tech, created by the MATRIX Lab team.

Guidelines:
- Answer questions naturally and conversationally
- Use the provided context when relevant to the user's question
- If context doesn't contain the answer, say "I don't know" or give your best guess with "I think that..."
- Don't repeat yourself or use template responses
- Don't announce your name or creator unless specifically asked
- Focus on being helpful and direct
- If the user's question is unclear or off-topic, ask for clarification

Respond naturally to the conversation flow and the user's current question.`;

  messages.push({
    role: "system",
    content: systemMessage,
  });

  // Add the current RAG context as a separate "user" role
  if (contextStr && contextStr.trim() !== "") {
    messages.push({
      role: "user",
      content: `CONTEXT FOR CURRENT QUESTION:
${contextStr}`,
    });
  }

  // Add conversation history if it exists (filtered to exclude previous context roles)
  if (conversationHistory && conversationHistory.trim() !== "") {
    // Filter out any context roles from previous interactions and clean up
    const cleanHistory = conversationHistory
      .split("\n\n")
      .filter((section) => {
        const lowerSection = section.toLowerCase();
        return (
          !lowerSection.includes("context for current question:") &&
          !lowerSection.includes("invention studio context:") &&
          section.trim().length > 0
        );
      })
      .join("\n\n")
      .trim();

    if (cleanHistory) {
      messages.push({
        role: "user",
        content: cleanHistory,
      });
    }
  }

  // Add the current question
  messages.push({
    role: "user",
    content: question,
  });

  return {
    messages,
    max_tokens: 500,
    temperature: 0.75,
  };
}

// --- RAG Query Function with Chutes API ---
async function ragQuery(
  question: string,
  conversationHistory: string = "",
): Promise<[string | ReadableStream<Uint8Array>, any[]]> {
  try {
    // Use intelligent context extraction for better embeddings
    let textForEmbedding = extractEmbeddingContext(conversationHistory, question);

    // Define a maximum character length for the text to be embedded.
    // The model itself truncates to 512 tokens.
    // 1500 --> likes to pigeon hole into past conversationHistory.
    // 750  --> attempt to pigeon hole less.
    const MAX_CHARS_FOR_EMBEDDING_CONTENT = 350;
    if (textForEmbedding.length > MAX_CHARS_FOR_EMBEDDING_CONTENT) {
      console.log(
        `Truncating textForEmbedding from ${textForEmbedding.length} to ${MAX_CHARS_FOR_EMBEDDING_CONTENT} chars.`,
      );
      // Truncate from the beginning, preserving the most recent text (including the question).
      textForEmbedding = textForEmbedding.slice(-MAX_CHARS_FOR_EMBEDDING_CONTENT);
    }

    // Focus primarily on the current question for better relevance
    const questionVecEmbeddings = await embedDocs([question]);
    const queryVecEmbeddings =
      textForEmbedding !== question ? await embedDocs([textForEmbedding]) : questionVecEmbeddings; // Use same embeddings if no conversation context

    if (
      !queryVecEmbeddings ||
      !questionVecEmbeddings ||
      !Array.isArray(queryVecEmbeddings) ||
      queryVecEmbeddings.length === 0 ||
      !Array.isArray(queryVecEmbeddings[0])
    ) {
      throw new Error("Failed to get valid embeddings for the question.");
    }

    // Take the first embedding
    const queryVec = queryVecEmbeddings[0];
    const questionVec = questionVecEmbeddings[0];
    if (
      !Array.isArray(queryVec) ||
      !Array.isArray(questionVec) ||
      queryVec.length !== 1024 ||
      questionVec.length !== 1024
    ) {
      // ensure embedding length of 1024
      throw new Error("Unexpected embedding structure.");
    }

    // Prioritize question-based search over conversation context
    const questionResult = await index.query({
      vector: questionVec,
      topK: 4,
      includeMetadata: true,
    });

    let contexts = questionResult.matches;

    // Only add query results if they're different and potentially relevant
    if (queryVec !== questionVec) {
      const queryResult = await index.query({
        vector: queryVec,
        topK: 2,
        includeMetadata: true,
      });

      // Filter out duplicate contexts and low-relevance ones
      const uniqueQueryMatches = queryResult.matches.filter(
        (match) =>
          !contexts.some((existing) => existing.id === match.id) &&
          match.score &&
          match.score > 0.3,
      );

      contexts = contexts.concat(uniqueQueryMatches);
    }

    // Filter out low-relevance contexts before processing
    const relevantContexts = contexts.filter((match) => {
      if (!match.score || match.score < 0.25) return false;
      if (!match.metadata?.text) return false;

      // Basic relevance check - avoid completely unrelated content
      const contextText =
        typeof match.metadata.text === "string" ? match.metadata.text.toLowerCase() : "";
      const questionLower = question.toLowerCase();

      // If question is about capacity/people/space, avoid button/manufacturing contexts
      if (
        questionLower.includes("people") ||
        questionLower.includes("fit") ||
        questionLower.includes("capacity")
      ) {
        if (contextText.includes("button") && contextText.includes("limit of 20")) {
          return false;
        }
      }

      return true;
    });

    // Create array of objects with text and filename
    const contextObjects = relevantContexts
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
    // Initialize metrics for conversation tracking
    let metrics: ConversationMetrics = {
      originalMessageCount: 0,
      prunedMessageCount: 0,
      totalCharsOriginal: 0,
      totalCharsPruned: 0,
      compressionRatio: 1,
      hasSummary: false,
      shouldSuggestRestart: false,
    };

    // Process and prune conversation history intelligently
    let conversationHistory = "";
    if (history.length > 0) {
      // Convert to internal format and add timestamps
      const messages: ConversationMessage[] = history.map(
        (msg: { role: string; content: string }) => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
          timestamp: Date.now(),
        }),
      );

      // Apply smart pruning
      const prunedHistory = pruneConversationHistory(messages, question);
      metrics = calculateConversationMetrics(messages, prunedHistory);
      conversationHistory = formatHistoryForModel(prunedHistory);

      console.log(
        `History optimization: ${metrics.originalMessageCount} -> ${metrics.prunedMessageCount} messages, ` +
          `${metrics.totalCharsOriginal} -> ${metrics.totalCharsPruned} chars ` +
          `(${(metrics.compressionRatio * 100).toFixed(1)}% compression)` +
          `${metrics.hasSummary ? " [with summary]" : ""}` +
          `${metrics.shouldSuggestRestart ? " [RESTART RECOMMENDED]" : ""}`,
      );

      // Log restart suggestion for monitoring
      if (metrics.shouldSuggestRestart) {
        console.warn(
          `Conversation getting too long - consider suggesting a fresh start to user. ` +
            `Messages: ${metrics.originalMessageCount}, Compression: ${(metrics.compressionRatio * 100).toFixed(1)}%`,
        );
      }
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

      // Send contexts data and metrics as the first events
      res.write(`data: ${JSON.stringify({ type: "contexts", contexts })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "metrics", metrics })}\n\n`);

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
        } finally {
          // Perform background optimization after response is complete
          if (history.length > 0) {
            const messages: ConversationMessage[] = history.map(
              (msg: { role: string; content: string }) => ({
                role: msg.role === "user" ? "user" : "assistant",
                content: msg.content,
                timestamp: Date.now(),
              }),
            );

            // Run optimization in background (don't await)
            performBackgroundOptimization(messages, question, "", contexts).catch(console.error);
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
      return res.status(200).json({ answer: streamOrString, contexts, metrics });
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
