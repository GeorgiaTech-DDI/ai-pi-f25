import { Pinecone } from "@pinecone-database/pinecone";
import type { NextApiRequest, NextApiResponse } from "next";
import { Embeddings } from "deepinfra";
import { getPostHogClient } from "../../lib/posthog-server";

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
/**
 * Classify user query to determine if RAG is needed
 * Returns: { needsRAG: boolean, reasoning?: string }
 */
async function classifyQuery(question: string): Promise<{ needsRAG: boolean; reasoning?: string }> {
  try {
    const classificationPrompt = `You are a query classifier for an Invention Studio chatbot at Georgia Tech.

The Invention Studio is a makerspace with equipment like 3D printers, laser cutters, CNC machines, etc.

Classify this query as GENERAL or RAG:
- GENERAL: Simple greetings, farewells, gratitude, general knowledge questions, conversational responses
- RAG: Questions about Invention Studio equipment, policies, procedures, hours, training, materials, or anything requiring studio-specific information

Examples:
"hi" → GENERAL
"What are the laser cutter hours?" → RAG
"thanks" → GENERAL
"Can I use wood in the CNC?" → RAG (needs studio material policies)
"What is 3D printing?" → GENERAL (general knowledge)
"How do I book the 3D printer?" → RAG (studio-specific procedure)

Question: "${question}"

Respond ONLY with valid JSON in this exact format:
{"classification": "GENERAL", "reasoning": "brief explanation"}
OR
{"classification": "RAG", "reasoning": "brief explanation"}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
        "HTTP-Referer": process.env.PUBLIC_SITE_URL || "https://matrixlab.gatech.edu",
        "X-Title": "Matrix Lab AI",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "google/gemma-3n-e4b-it:free",
        messages: [
          {
            role: "user",
            content: classificationPrompt,
          },
        ],
        max_tokens: 100,
        temperature: 0.1, // Low temperature for consistent classification
        stream: false,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Classification API error: ${response.status}, defaulting to RAG`);
      return { needsRAG: true, reasoning: "Classification failed, defaulting to RAG for safety" };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.warn("Empty classification response, defaulting to RAG");
      return { needsRAG: true, reasoning: "Empty response, defaulting to RAG" };
    }

    // Try to parse JSON response
    let classification: { classification: string; reasoning: string };
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\s*|\s*```/g, "").trim();
      classification = JSON.parse(cleanContent);
    } catch (parseError) {
      console.warn("Failed to parse classification JSON, defaulting to RAG:", content);
      return { needsRAG: true, reasoning: "JSON parse failed, defaulting to RAG" };
    }

    const needsRAG = classification.classification === "RAG";
    console.log(
      `Query classified as ${classification.classification}: "${question}" - ${classification.reasoning}`,
    );

    return {
      needsRAG,
      reasoning: classification.reasoning,
    };
  } catch (error) {
    console.warn("Classification error:", error, "- defaulting to RAG");
    // Default to RAG on error (safer to have unnecessary references than miss important info)
    return { needsRAG: true, reasoning: "Classification error, defaulting to RAG for safety" };
  }
}

/**
 * Use LLM to extract up to 10 tokens as keyword for DuckDuckGo search
 */
async function extractKeywordForDuckDuckGo(question: string): Promise<string> {
  try {
    const keywordExtractionPrompt = `Extract the most important search keywords from this question for finding general information on DuckDuckGo. You can provide multiple keyword variations separated by commas, with the most important first.

Examples:
Question: "How does laser cutting work?"
Keywords: laser cutting, laser cutting process, industrial laser cutting

Question: "What materials can be used in 3D printing?"
Keywords: 3D printing materials, additive manufacturing materials, printing filaments

Question: "How do I maintain a CNC machine?"
Keywords: CNC machine maintenance, CNC maintenance procedures, machine tool maintenance

Question: "What safety precautions are needed for waterjet cutting?"
Keywords: waterjet cutting safety, waterjet safety procedures, high pressure cutting safety

Question: "Can you explain the difference between milling and turning?"
Keywords: milling turning difference, machining processes comparison, milling vs turning

Question: "${question}"

Return only the keywords as comma-separated phrases, no explanation:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for keyword extraction

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
        "HTTP-Referer": process.env.PUBLIC_SITE_URL || "https://matrixlab.gatech.edu",
        "X-Title": "Matrix Lab AI",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "google/gemma-3n-e4b-it:free",
        messages: [
          {
            role: "user",
            content: keywordExtractionPrompt,
          },
        ],
        max_tokens: 20,
        temperature: 0.1,
        stream: false,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const keywords = data.choices?.[0]?.message?.content?.trim();

    if (!keywords || keywords.length < 2) {
      throw new Error("No valid keywords extracted");
    }

    // Take the first keyword from comma-separated list for the search
    const keywordList = keywords.split(",").map((k: string) => k.trim());
    let primaryKeyword = keywordList[0] || keywords;

    // Ensure primary keyword doesn't exceed 10 tokens
    const tokens = primaryKeyword.split(/\s+/);
    if (tokens.length > 10) {
      primaryKeyword = tokens.slice(0, 10).join(" ");
    }

    console.log(`LLM extracted keywords: "${keywords}" -> using primary: "${primaryKeyword}"`);
    return primaryKeyword;
  } catch (error) {
    console.warn("LLM keyword extraction failed:", error);
    return "";
  }
}

/**
 * Fetch context from DuckDuckGo Instant Answers API
 */
async function fetchDuckDuckGoContext(keyword: string): Promise<{
  text: string;
  source: string;
  filename: string;
} | null> {
  try {
    const encodedKeyword = encodeURIComponent(keyword);
    const url = `https://api.duckduckgo.com/?q=${encodedKeyword}&format=json&no_html=1&skip_disambig=1`;

    console.log(`Fetching DuckDuckGo context for: "${keyword}" from ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Matrix Lab AI (matrixlab.gatech.edu)",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`DuckDuckGo API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Log the structure for debugging
    console.log(`DuckDuckGo response structure for "${keyword}":`, {
      hasAbstract: !!data.Abstract,
      abstractLength: data.Abstract?.length || 0,
      hasAbstractText: !!data.AbstractText,
      abstractTextLength: data.AbstractText?.length || 0,
      abstractSource: data.AbstractSource || null,
      hasDefinition: !!data.Definition,
      definitionLength: data.Definition?.length || 0,
      hasAnswer: !!data.Answer,
      answerLength: data.Answer?.length || 0,
      relatedTopicsCount: data.RelatedTopics?.length || 0,
      relatedTopicsStructure: data.RelatedTopics?.slice(0, 2).map((topic: any) => ({
        hasText: !!topic.Text,
        textLength: topic.Text?.length || 0,
        hasName: !!topic.Name,
        hasTopics: !!topic.Topics,
        topicsCount: topic.Topics?.length || 0,
      })),
    });

    // Extract useful information from the response
    let contextText = "";
    let source = "DuckDuckGo";

    // Try different fields in order of preference - Abstract is the highest priority
    if (data.Abstract && data.Abstract.trim()) {
      contextText = data.Abstract;
      source = data.AbstractSource || "DuckDuckGo Abstract";
      console.log(`Using Abstract from ${source}: ${contextText.length} chars`);
    } else if (data.AbstractText && data.AbstractText.trim()) {
      contextText = data.AbstractText;
      source = data.AbstractSource || "DuckDuckGo Abstract";
      console.log(`Using AbstractText from ${source}: ${contextText.length} chars`);
    } else if (data.Definition && data.Definition.trim()) {
      contextText = data.Definition;
      source = data.DefinitionSource || "DuckDuckGo Definition";
      console.log(`Using Definition from ${source}: ${contextText.length} chars`);
    } else if (data.Answer && data.Answer.trim()) {
      contextText = data.Answer;
      source = "DuckDuckGo Answer";
      console.log(`Using Answer: ${contextText.length} chars`);
    } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      // Find the most relevant topic from RelatedTopics
      const directTopics = data.RelatedTopics.filter(
        (topic: any) => topic.Text && !topic.Name && topic.Text.length > 20,
      );

      if (directTopics.length > 0) {
        // Use the first direct topic
        contextText = directTopics[0].Text;
        source = "DuckDuckGo Related Topics";
        console.log(`Using direct Related Topic: ${contextText.length} chars`);
      } else {
        // Look for topics with subtopics (categorized results)
        for (const topicGroup of data.RelatedTopics) {
          if (topicGroup.Topics && topicGroup.Topics.length > 0) {
            // Find the most relevant subtopic
            const subtopic = topicGroup.Topics.find((sub: any) => sub.Text && sub.Text.length > 20);
            if (subtopic) {
              contextText = subtopic.Text;
              source = `DuckDuckGo ${topicGroup.Name || "Related Topics"}`;
              console.log(
                `Using categorized Related Topic from ${topicGroup.Name}: ${contextText.length} chars`,
              );
              break;
            }
          }
        }
      }

      // Fallback to any available topic
      if (!contextText && data.RelatedTopics[0]?.Text) {
        contextText = data.RelatedTopics[0].Text;
        source = "DuckDuckGo Related Topics";
        console.log(`Using fallback Related Topic: ${contextText.length} chars`);
      }
    }

    if (!contextText || contextText.trim().length < 10) {
      console.log(`No useful context found in DuckDuckGo response for "${keyword}"`);
      return null;
    }

    // Limit context length to avoid overwhelming the model
    if (contextText.length > 500) {
      contextText = contextText.substring(0, 497) + "...";
    }

    console.log(`DuckDuckGo context found: ${contextText.length} chars from ${source}`);

    return {
      text: contextText,
      source: source,
      filename: `external-${keyword.replace(/\s+/g, "-")}.ddg`,
    };
  } catch (error) {
    console.warn(`Failed to fetch DuckDuckGo context for "${keyword}":`, error);
    return null;
  }
}

/**
 * Generate response for general queries without RAG
 * Returns a streaming response for conversational queries
 */
async function generateGeneralResponse(
  question: string,
  conversationHistory: string = "",
): Promise<ReadableStream<Uint8Array>> {
  try {
    const messages: Array<{ role: string; content: string }> = [];

    // System message for general conversational responses
    const systemMessage = `You are AI PI, a helpful assistant for the Invention Studio at Georgia Tech, created by the MATRIX Lab team.

Guidelines:
- Answer questions naturally and conversationally using your general knowledge
- Be friendly and helpful
- If asked about specific Invention Studio details (equipment, policies, hours), politely mention you need more specific information
- Don't make up specific studio policies or details
- Keep responses concise and helpful
- Don't announce your name or creator unless specifically asked

Respond naturally to the user's question.`;

    messages.push({
      role: "system",
      content: systemMessage,
    });

    // Add conversation history if it exists
    if (conversationHistory && conversationHistory.trim() !== "") {
      messages.push({
        role: "user",
        content: conversationHistory,
      });
    }

    // Add the current question
    messages.push({
      role: "user",
      content: question,
    });

    // Call the OpenRouter API with streaming
    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
        "HTTP-Referer": process.env.PUBLIC_SITE_URL || "https://matrixlab.gatech.edu",
        "X-Title": "Matrix Lab AI",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        model: "google/gemma-3-27b-it:free",
        stream: true,
        max_tokens: 500,
        temperature: 0.75,
        provider: {
          order: ["Chutes"],
        },
      }),
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      throw new Error(`OpenRouter API error: ${openRouterResponse.status} - ${errorText}`);
    }

    console.log(`General response stream started (no RAG)`);
    return openRouterResponse.body as ReadableStream<Uint8Array>;
  } catch (error) {
    console.error("Error in generateGeneralResponse:", error);
    throw error;
  }
}

async function ragQuery(
  question: string,
  conversationHistory: string = "",
  res?: NextApiResponse,
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

    // Get DuckDuckGo context first (with error handling)
    const keyword = await extractKeywordForDuckDuckGo(question);
    console.log(`Extracted keyword for DuckDuckGo: "${keyword}"`);
    let duckDuckGoContext = null;
    try {
      duckDuckGoContext = await fetchDuckDuckGoContext(keyword);
    } catch (ddgError) {
      console.warn(`DuckDuckGo integration failed for keyword "${keyword}":`, ddgError);
    } finally {
      // Always emit web search complete event regardless of success/failure
      if (res) {
        res.write(
          `data: ${JSON.stringify({
            type: "web_search_complete",
            found: !!duckDuckGoContext,
            keyword: keyword,
            source: duckDuckGoContext?.source || null,
            error: !duckDuckGoContext,
          })}\n\n`,
        );
      }
    }

    // Adjust RAG results based on whether we have DuckDuckGo context
    const questionResult = await index.query({
      vector: questionVec,
      topK: duckDuckGoContext ? 3 : 4, // Reduce by 1 only if we have DuckDuckGo context
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
      return true;
    });

    // ========================================
    // OPTION 2: SMART FALLBACK - CONFIDENCE THRESHOLD CHECK
    // ========================================
    const CONFIDENCE_THRESHOLD = 0.6;
    const bestScore = relevantContexts.length > 0 
      ? Math.max(...relevantContexts.map(match => match.score || 0))
      : 0;

    console.log(`RAG Quality Check: Best match score = ${bestScore.toFixed(3)}, Threshold = ${CONFIDENCE_THRESHOLD}`);

    // Log RAG performance for admin analytics
    const ragPerformanceLog = {
      timestamp: new Date().toISOString(),
      question: question,
      bestScore: bestScore,
      totalMatches: contexts.length,
      relevantMatches: relevantContexts.length,
      matchesAbove06: relevantContexts.filter(m => (m.score || 0) >= 0.6).length,
      matchesAbove05: relevantContexts.filter(m => (m.score || 0) >= 0.5).length,
      matchesAbove04: relevantContexts.filter(m => (m.score || 0) >= 0.4).length,
      topDocuments: relevantContexts.slice(0, 3).map(m => ({
        filename: m.metadata?.filename || 'unknown',
        score: m.score || 0
      })),
      decision: bestScore >= CONFIDENCE_THRESHOLD ? 'USE_RAG' : 'USE_GENERAL',
      confidenceLevel: bestScore >= 0.7 ? 'high' : bestScore >= 0.5 ? 'medium' : 'low'
    };

    console.log('📊 RAG Performance:', JSON.stringify(ragPerformanceLog, null, 2));

    // Store log in Pinecone for admin analytics
    try {
      // Serialize topDocuments array to JSON string for Pinecone metadata
      const metadataForPinecone = {
        type: 'query_log',
        timestamp: ragPerformanceLog.timestamp,
        question: ragPerformanceLog.question,
        bestScore: ragPerformanceLog.bestScore,
        totalMatches: ragPerformanceLog.totalMatches,
        relevantMatches: ragPerformanceLog.relevantMatches,
        matchesAbove06: ragPerformanceLog.matchesAbove06,
        matchesAbove05: ragPerformanceLog.matchesAbove05,
        matchesAbove04: ragPerformanceLog.matchesAbove04,
        topDocuments: JSON.stringify(ragPerformanceLog.topDocuments), // Serialize to string
        decision: ragPerformanceLog.decision,
        confidenceLevel: ragPerformanceLog.confidenceLevel
      };

      // Create dummy vector with at least one non-zero value (Pinecone requirement)
      const dummyVector = new Array(1024).fill(0);
      dummyVector[0] = 0.0001; // Small non-zero value to satisfy Pinecone

      await index.upsert([{
        id: `query-log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        values: dummyVector,
        metadata: metadataForPinecone
      }]);
      console.log('✅ Query log stored in Pinecone for admin analytics');
    } catch (logError) {
      console.warn('⚠️ Failed to store query log:', logError);
      // Don't throw - logging failure shouldn't break the query
    }

    // If best match score is below confidence threshold, abandon RAG
    if (bestScore < CONFIDENCE_THRESHOLD) {
      console.log(
        `⚠️ RAG ABANDONED: Best score (${bestScore.toFixed(3)}) below confidence threshold (${CONFIDENCE_THRESHOLD}). ` +
        `Using general knowledge instead.`
      );
      
      // Return empty contexts to signal general knowledge should be used
      return [
        await generateGeneralResponse(question, conversationHistory),
        [] // Empty contexts array - no references to show
      ];
    }

    console.log(`✅ RAG APPROVED: Best score (${bestScore.toFixed(3)}) meets confidence threshold. Proceeding with RAG.`);

    // Create array of objects with text and filename, including DuckDuckGo context
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

    // Add DuckDuckGo context if available
    if (duckDuckGoContext) {
      contextObjects.unshift({
        text: duckDuckGoContext.text, // Clean text without prefix for LLM
        filename: duckDuckGoContext.filename,
      });
      console.log(
        `Added DuckDuckGo context for keyword "${keyword}" from ${duckDuckGoContext.source} (${duckDuckGoContext.text.length} chars)`,
      );
    } else {
      console.log(`No DuckDuckGo context found for keyword "${keyword}"`);
    }

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

    // Create enhanced contexts array that includes DuckDuckGo info
    let enhancedContexts = contexts;
    if (duckDuckGoContext) {
      // Add a synthetic context object for the frontend
      const duckDuckGoMatch = {
        id: `ddg-${keyword}`,
        score: 1.0, // High relevance score for external context
        values: [],
        metadata: {
          chunk_idx: -1,
          filename: `🌐 ${duckDuckGoContext.source}`,
          text: duckDuckGoContext.text,
          source: duckDuckGoContext.source,
        },
      };
      enhancedContexts = [duckDuckGoMatch, ...contexts];
      console.log(`Enhanced contexts array created with DuckDuckGo context at position 0`);
    }

    // For streaming responses, return the stream directly
    return [openRouterResponse.body as ReadableStream<Uint8Array>, enhancedContexts];
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

  // Capture server-side chat request event
  const distinctId =
    (req.headers["x-posthog-distinct-id"] as string) ||
    (req.headers["x-forwarded-for"] as string) ||
    req.socket.remoteAddress ||
    "anonymous";
  const phServer = getPostHogClient();
  phServer.capture({
    distinctId,
    event: "server_chat_request",
    properties: {
      question_length: question.length,
      history_length: Array.isArray(history) ? history.length : 0,
    },
  });

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

    // Set appropriate headers for streaming before starting
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Classify the query first
    console.log(`Classifying query: "${question}"`);
    const classification = await classifyQuery(question);
    console.log(
      `Classification result: ${classification.needsRAG ? "RAG" : "GENERAL"} - ${classification.reasoning}`,
    );

    let streamOrString: string | ReadableStream<Uint8Array>;
    let contexts: any[] = [];
    let usedRAG = false;

    if (classification.needsRAG) {
      // Query needs RAG - perform web search and vector search
      usedRAG = true;

      // Emit web search loading event
      res.write(
        `data: ${JSON.stringify({ type: "web_search_loading", message: "Searching web for additional context..." })}\n\n`,
      );

      // Pass both the current question and conversation history to ragQuery
      const [stream, ragContexts] = await ragQuery(question, conversationHistory, res);
      streamOrString = stream;
      contexts = ragContexts;
    } else {
      // Query is general - skip RAG and respond directly
      usedRAG = false;

      // Emit event indicating no RAG is being used
      res.write(
        `data: ${JSON.stringify({ type: "classification", usedRAG: false, reasoning: classification.reasoning })}\n\n`,
      );

      // Log GENERAL classified query for analytics
      try {
        const generalQueryLog = {
          timestamp: new Date().toISOString(),
          question: question,
          bestScore: 0, // No RAG search performed
          totalMatches: 0,
          relevantMatches: 0,
          matchesAbove06: 0,
          matchesAbove05: 0,
          matchesAbove04: 0,
          topDocuments: [],
          decision: 'USE_GENERAL',
          confidenceLevel: 'n/a' // Not applicable for GENERAL queries
        };

        console.log('📊 GENERAL Query:', JSON.stringify(generalQueryLog, null, 2));

        // Store log in Pinecone
        const dummyVector = new Array(1024).fill(0);
        dummyVector[0] = 0.0001;

        await index.upsert([{
          id: `query-log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          values: dummyVector,
          metadata: {
            type: 'query_log',
            timestamp: generalQueryLog.timestamp,
            question: generalQueryLog.question,
            bestScore: generalQueryLog.bestScore,
            totalMatches: generalQueryLog.totalMatches,
            relevantMatches: generalQueryLog.relevantMatches,
            matchesAbove06: generalQueryLog.matchesAbove06,
            matchesAbove05: generalQueryLog.matchesAbove05,
            matchesAbove04: generalQueryLog.matchesAbove04,
            topDocuments: JSON.stringify(generalQueryLog.topDocuments),
            decision: generalQueryLog.decision,
            confidenceLevel: generalQueryLog.confidenceLevel
          }
        }]);
        console.log('✅ GENERAL query log stored in Pinecone for admin analytics');
      } catch (logError) {
        console.warn('⚠️ Failed to store GENERAL query log:', logError);
        // Don't throw - logging failure shouldn't break the query
      }

      // Generate response without RAG
      streamOrString = await generateGeneralResponse(question, conversationHistory);
      contexts = []; // No contexts for general queries
    }

    // If we got a stream back, pipe it to the client
    if (streamOrString instanceof ReadableStream) {
      console.log("Starting stream response");

      // Send contexts data and metrics as the first events
      console.log(`Sending ${contexts.length} contexts to frontend (usedRAG: ${usedRAG}):`);
      if (usedRAG) {
        console.log(
          `Context breakdown: ${contexts.filter((ctx) => ctx.id?.startsWith("ddg-")).length} DuckDuckGo, ${contexts.filter((ctx) => !ctx.id?.startsWith("ddg-")).length} RAG`,
        );
      }
      res.write(`data: ${JSON.stringify({ type: "contexts", contexts, usedRAG })}\n\n`);
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
