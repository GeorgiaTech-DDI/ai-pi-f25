import { Pinecone } from "@pinecone-database/pinecone";
import { NextRequest } from "next/server";
import { Embeddings } from "deepinfra";
import type { Stream } from "openai/streaming";
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { getOpenRouter } from "../../../lib/openrouter";

export const maxDuration = 60;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  contexts?: any[];
}
interface PrunedHistory {
  recentMessages: ConversationMessage[];
  summaryContext?: string;
  totalChars: number;
}
interface ConversationMetrics {
  originalMessageCount: number;
  prunedMessageCount: number;
  totalCharsOriginal: number;
  totalCharsPruned: number;
  compressionRatio: number;
  hasSummary: boolean;
  shouldSuggestRestart: boolean;
}

const HISTORY_CONFIG = {
  MAX_RECENT_MESSAGES: 8,
  MAX_TOTAL_CHARS: 5000,
  MIN_RELEVANCE_SCORE: 0.3,
  SUMMARY_THRESHOLD: 10,
};

// ──────────────────────────────────────────────
// Pinecone
// ──────────────────────────────────────────────
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || "" });
const index = pinecone.index(
  process.env.PINECONE_INDEX_NAME || "rag-embeddings",
);

// ──────────────────────────────────────────────
// History management (identical logic to pages/api/chutes.ts)
// ──────────────────────────────────────────────
function summarizeOldContext(messages: ConversationMessage[]): string {
  const topics = new Set<string>();
  const keyPhrases: string[] = [];
  messages.forEach((msg) => {
    msg.content.split(/\s+/).forEach((word) => {
      const cleaned = word.replace(/[^\w]/g, "").toLowerCase();
      if (cleaned.length > 5 && !topics.has(cleaned)) {
        topics.add(cleaned);
        keyPhrases.push(cleaned);
      }
    });
  });
  return keyPhrases.length === 0
    ? ""
    : `PREVIOUS TOPICS: ${keyPhrases.slice(0, 8).join(", ")}`;
}

function pruneConversationHistory(
  messages: ConversationMessage[],
  currentQuestion: string,
): PrunedHistory {
  if (messages.length === 0) return { recentMessages: [], totalChars: 0 };
  const recentMessages = messages.slice(-HISTORY_CONFIG.MAX_RECENT_MESSAGES);
  let totalChars = recentMessages.reduce(
    (sum, msg) => sum + msg.content.length,
    0,
  );
  if (
    totalChars <= HISTORY_CONFIG.MAX_TOTAL_CHARS &&
    messages.length <= HISTORY_CONFIG.SUMMARY_THRESHOLD
  ) {
    return { recentMessages, totalChars };
  }
  let finalMessages = [...recentMessages];
  let summaryContext: string | undefined;
  if (messages.length > HISTORY_CONFIG.SUMMARY_THRESHOLD) {
    summaryContext = summarizeOldContext(
      messages.slice(0, -HISTORY_CONFIG.MAX_RECENT_MESSAGES),
    );
  }
  while (
    totalChars > HISTORY_CONFIG.MAX_TOTAL_CHARS &&
    finalMessages.length > 2
  ) {
    const removed = finalMessages.shift();
    if (removed) totalChars -= removed.content.length;
  }
  return {
    recentMessages: finalMessages,
    summaryContext,
    totalChars: totalChars + (summaryContext?.length || 0),
  };
}

function calculateConversationMetrics(
  originalMessages: ConversationMessage[],
  prunedHistory: PrunedHistory,
): ConversationMetrics {
  const originalChars = originalMessages.reduce(
    (sum, msg) => sum + msg.content.length,
    0,
  );
  const compressionRatio =
    originalChars > 0 ? prunedHistory.totalChars / originalChars : 1;
  return {
    originalMessageCount: originalMessages.length,
    prunedMessageCount: prunedHistory.recentMessages.length,
    totalCharsOriginal: originalChars,
    totalCharsPruned: prunedHistory.totalChars,
    compressionRatio,
    hasSummary: !!prunedHistory.summaryContext,
    shouldSuggestRestart:
      originalMessages.length > 30 ||
      compressionRatio < 0.3 ||
      originalChars > 8000,
  };
}

function formatHistoryForModel(prunedHistory: PrunedHistory): string {
  let formatted = prunedHistory.summaryContext
    ? `${prunedHistory.summaryContext}\n\n`
    : "";
  if (prunedHistory.recentMessages.length > 0) {
    formatted += "Previous conversation:\n";
    const cleanMessages = prunedHistory.recentMessages
      .filter(
        (msg) =>
          !["context for current question:", "invention studio context:"].some(
            (s) => msg.content.toLowerCase().includes(s),
          ),
      )
      .map((msg) => {
        let content = msg.content
          .replace(/CONTEXT FOR CURRENT QUESTION:[\s\S]*?(?=\n\n|$)/g, "")
          .replace(/Previous conversation:[\s\S]*?Current question:/g, "")
          .replace(/INVENTION STUDIO CONTEXT:[\s\S]*?(?=\n\n|$)/g, "")
          .trim();
        return `${msg.role === "user" ? "User" : "Assistant"}: ${content}`;
      })
      .filter((msg) => msg.length > (msg.startsWith("User: ") ? 6 : 11));
    formatted += cleanMessages.join("\n\n");
  }
  return formatted;
}

function extractEmbeddingContext(
  conversationHistory: string,
  currentQuestion: string,
): string {
  if (!conversationHistory) return currentQuestion;
  const userMessages = conversationHistory
    .split("\n")
    .filter((l) => l.startsWith("user:"))
    .map((l) => l.replace("user:", "").trim());
  const recentQuestions = userMessages.slice(-2);
  const keyTerms = new Set<string>();
  recentQuestions.forEach((q) => {
    q.split(/\s+/).forEach((word) => {
      const cleaned = word.replace(/[^\w]/g, "").toLowerCase();
      if (
        cleaned.length > 4 &&
        ![
          "that",
          "this",
          "with",
          "from",
          "they",
          "them",
          "were",
          "have",
          "been",
        ].includes(cleaned)
      )
        keyTerms.add(cleaned);
    });
  });
  const contextTerms = Array.from(keyTerms).slice(0, 5).join(" ");
  return contextTerms ? `${contextTerms} ${currentQuestion}` : currentQuestion;
}

// ──────────────────────────────────────────────
// Embedding
// ──────────────────────────────────────────────
async function isOllamaRunning(timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(`${process.env.OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

async function embedDocs(docs: string[]): Promise<number[][]> {
  const prefixedDocs = docs.map((d) => `query: ${d}`);
  const ollamaAvailable = await isOllamaRunning();
  if (ollamaAvailable) {
    const response = await fetch(`${process.env.OLLAMA_URL}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: prefixedDocs,
        model: "jeffh/intfloat-multilingual-e5-large:f16",
      }),
    });
    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
    const result = await response.json();
    if (!result.data || !Array.isArray(result.data))
      throw new Error("Unexpected Ollama embedding format");
    return result.data.map((item: any) => item.embedding);
  }
  if (process.env.DEEPINFRA_API_KEY) {
    const client = new Embeddings(
      "intfloat/multilingual-e5-large",
      process.env.DEEPINFRA_API_KEY,
    );
    const output = await client.generate({ inputs: docs });
    return output.embeddings;
  }
  const hfApiUrl = process.env.HF_API_URL;
  const hfApiKey = process.env.HF_API_KEY;
  if (!hfApiUrl || !hfApiKey)
    throw new Error("No embedding provider configured");
  const embeddings: number[][] = [];
  for (const doc of prefixedDocs) {
    const response = await fetch(hfApiUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${hfApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: doc }),
    });
    if (!response.ok) throw new Error(`Hugging Face error: ${response.status}`);
    embeddings.push(await response.json());
  }
  return embeddings;
}

// ──────────────────────────────────────────────
// Context construction
// ──────────────────────────────────────────────
function constructContext(
  contexts: Array<{ text: string; filename: string }>,
  maxSectionLen = 5000,
) {
  const chosen: string[] = [];
  let len = 0;
  for (const ctx of contexts) {
    const formatted = `[Source: ${ctx.filename}]\n${ctx.text.trim()}`;
    len += formatted.length + 2;
    if (len > maxSectionLen) break;
    chosen.push(formatted);
  }
  return chosen.join("\n\n");
}

function createPayload(
  question: string,
  contextStr: string,
  conversationHistory: string = "",
): {
  messages: ChatCompletionMessageParam[];
  max_tokens: number;
  temperature: number;
} {
  const messages: ChatCompletionMessageParam[] = [];
  messages.push({
    role: "system",
    content: `You are AI PI, a helpful assistant for the Invention Studio at Georgia Tech, created by the MATRIX Lab team.\n\nGuidelines:\n- Answer questions naturally and conversationally\n- Use the provided context when relevant to the user's question\n- If context doesn't contain the answer, say "I don't know" or give your best guess with "I think that..."\n- Don't repeat yourself or use template responses\n- Don't announce your name or creator unless specifically asked\n- Focus on being helpful and direct\n- If the user's question is unclear or off-topic, ask for clarification\n\nRespond naturally to the conversation flow and the user's current question.`,
  });
  if (contextStr?.trim())
    messages.push({
      role: "user",
      content: `CONTEXT FOR CURRENT QUESTION:\n${contextStr}`,
    });
  if (conversationHistory?.trim()) {
    const cleanHistory = conversationHistory
      .split("\n\n")
      .filter((s) => {
        const l = s.toLowerCase();
        return (
          !l.includes("context for current question:") &&
          !l.includes("invention studio context:") &&
          s.trim().length > 0
        );
      })
      .join("\n\n")
      .trim();
    if (cleanHistory) messages.push({ role: "user", content: cleanHistory });
  }
  messages.push({ role: "user", content: question });
  return { messages, max_tokens: 500, temperature: 0.75 };
}

// ──────────────────────────────────────────────
// Classification
// ──────────────────────────────────────────────
async function classifyQuery(
  question: string,
  posthogDistinctId = "anonymous",
): Promise<{ needsRAG: boolean; reasoning?: string }> {
  try {
    const openrouter = getOpenRouter();
    const response = await openrouter.complete(
      {
        messages: [
          {
            role: "user",
            content: `You are a query classifier for an Invention Studio chatbot at Georgia Tech.\n\nThe Invention Studio is a makerspace with equipment like 3D printers, laser cutters, CNC machines, etc.\n\nClassify this query as GENERAL or RAG:\n- GENERAL: Simple greetings, farewells, gratitude, general knowledge questions, conversational responses\n- RAG: Questions about Invention Studio equipment, policies, procedures, hours, training, materials, or anything requiring studio-specific information\n\nQuestion: "${question}"\n\nRespond ONLY with valid JSON:\n{"classification": "GENERAL", "reasoning": "brief explanation"}\nOR\n{"classification": "RAG", "reasoning": "brief explanation"}`,
          },
        ],
        max_tokens: 100,
        temperature: 0.1,
      },
      { posthogDistinctId },
    );
    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) return { needsRAG: true };
    const parsed = JSON.parse(content.replace(/```json\s*|\s*```/g, "").trim());
    return {
      needsRAG: parsed.classification === "RAG",
      reasoning: parsed.reasoning,
    };
  } catch {
    return {
      needsRAG: true,
      reasoning: "Classification error, defaulting to RAG",
    };
  }
}

// ──────────────────────────────────────────────
// DuckDuckGo
// ──────────────────────────────────────────────
async function extractKeywordForDuckDuckGo(
  question: string,
  posthogDistinctId = "anonymous",
): Promise<string> {
  try {
    const openrouter = getOpenRouter();
    const response = await openrouter.complete(
      {
        messages: [
          {
            role: "user",
            content: `Extract the most important search keywords from this question for DuckDuckGo. Return only comma-separated phrases, no explanation:\n\nQuestion: "${question}"`,
          },
        ],
        max_tokens: 20,
        temperature: 0.1,
      },
      { posthogDistinctId },
    );
    const keywords = response.choices?.[0]?.message?.content?.trim() || "";
    if (keywords.length < 2) return "";
    return keywords.split(",")[0].trim().split(/\s+/).slice(0, 10).join(" ");
  } catch {
    return "";
  }
}

async function fetchDuckDuckGoContext(
  keyword: string,
): Promise<{ text: string; source: string; filename: string } | null> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(keyword)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Matrix Lab AI (matrixlab.gatech.edu)" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    let contextText = "";
    let source = "DuckDuckGo";
    if (data.Abstract?.trim()) {
      contextText = data.Abstract;
      source = data.AbstractSource || "DuckDuckGo Abstract";
    } else if (data.AbstractText?.trim()) {
      contextText = data.AbstractText;
      source = data.AbstractSource || "DuckDuckGo Abstract";
    } else if (data.Definition?.trim()) {
      contextText = data.Definition;
      source = data.DefinitionSource || "DuckDuckGo Definition";
    } else if (data.Answer?.trim()) {
      contextText = data.Answer;
      source = "DuckDuckGo Answer";
    } else if (data.RelatedTopics?.length) {
      const direct = data.RelatedTopics.filter(
        (t: any) => t.Text && !t.Name && t.Text.length > 20,
      );
      if (direct.length) {
        contextText = direct[0].Text;
        source = "DuckDuckGo Related Topics";
      }
    }
    if (!contextText || contextText.trim().length < 10) return null;
    if (contextText.length > 500)
      contextText = contextText.substring(0, 497) + "...";
    return {
      text: contextText,
      source,
      filename: `external-${keyword.replace(/\s+/g, "-")}.ddg`,
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// General response stream
// ──────────────────────────────────────────────
async function generateGeneralResponse(
  question: string,
  conversationHistory: string = "",
  posthogDistinctId = "anonymous",
): Promise<Stream<ChatCompletionChunk>> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are AI PI, a helpful assistant for the Invention Studio at Georgia Tech, created by the MATRIX Lab team.\n\nGuidelines:\n- Answer questions naturally and conversationally using your general knowledge\n- Be friendly and helpful\n- If asked about specific Invention Studio details (equipment, policies, hours), politely mention you need more specific information\n- Don't make up specific studio policies or details\n- Keep responses concise and helpful\n- Don't announce your name or creator unless specifically asked",
    },
  ];
  if (conversationHistory?.trim())
    messages.push({ role: "user", content: conversationHistory });
  messages.push({ role: "user", content: question });
  const openrouter = getOpenRouter();
  console.debug(
    "[generateGeneralResponse] model:",
    process.env.OPENROUTER_MODEL,
  );
  try {
    return await openrouter.stream(
      {
        messages,
        max_tokens: 500,
        temperature: 0.75,
      },
      { posthogDistinctId, provider: { order: ["Chutes"] } },
    );
  } catch (err) {
    console.error("[generateGeneralResponse] OpenRouter SDK error:", err);
    throw err;
  }
}

// ──────────────────────────────────────────────
// RAG query — `emit` replaces `res.write` for App Router SSE compatibility
// ──────────────────────────────────────────────
async function ragQuery(
  question: string,
  conversationHistory: string = "",
  emit: (data: object) => void,
  posthogDistinctId = "anonymous",
): Promise<[Stream<ChatCompletionChunk>, any[]]> {
  let textForEmbedding = extractEmbeddingContext(conversationHistory, question);
  const MAX_CHARS = 350;
  if (textForEmbedding.length > MAX_CHARS)
    textForEmbedding = textForEmbedding.slice(-MAX_CHARS);

  const questionVecEmbeddings = await embedDocs([question]);
  const queryVecEmbeddings =
    textForEmbedding !== question
      ? await embedDocs([textForEmbedding])
      : questionVecEmbeddings;
  const queryVec = queryVecEmbeddings[0];
  const questionVec = questionVecEmbeddings[0];
  if (
    !Array.isArray(queryVec) ||
    !Array.isArray(questionVec) ||
    queryVec.length !== 1024 ||
    questionVec.length !== 1024
  )
    throw new Error("Unexpected embedding structure.");

  const keyword = await extractKeywordForDuckDuckGo(
    question,
    posthogDistinctId,
  );
  let duckDuckGoContext = null;
  try {
    duckDuckGoContext = await fetchDuckDuckGoContext(keyword);
  } catch {
    /* ignore */
  }
  emit({
    type: "web_search_complete",
    found: !!duckDuckGoContext,
    keyword,
    source: duckDuckGoContext?.source || null,
    error: !duckDuckGoContext,
  });

  const questionResult = await index.query({
    vector: questionVec,
    topK: duckDuckGoContext ? 3 : 4,
    includeMetadata: true,
  });
  let contexts = questionResult.matches;
  if (queryVec !== questionVec) {
    const queryResult = await index.query({
      vector: queryVec,
      topK: 2,
      includeMetadata: true,
    });
    const unique = queryResult.matches.filter(
      (m: any) =>
        !contexts.some((e: any) => e.id === m.id) && m.score && m.score > 0.3,
    );
    contexts = contexts.concat(unique);
  }

  const relevantContexts = contexts.filter(
    (m: any) => m.score && m.score >= 0.25 && m.metadata?.text,
  );
  const CONFIDENCE_THRESHOLD = 0.6;
  const bestScore =
    relevantContexts.length > 0
      ? Math.max(...relevantContexts.map((m: any) => m.score || 0))
      : 0;

  // Log RAG performance to Pinecone
  const ragLog = {
    timestamp: new Date().toISOString(),
    question,
    bestScore,
    totalMatches: contexts.length,
    relevantMatches: relevantContexts.length,
    matchesAbove06: relevantContexts.filter((m: any) => (m.score || 0) >= 0.6)
      .length,
    matchesAbove05: relevantContexts.filter((m: any) => (m.score || 0) >= 0.5)
      .length,
    matchesAbove04: relevantContexts.filter((m: any) => (m.score || 0) >= 0.4)
      .length,
    topDocuments: relevantContexts.slice(0, 3).map((m: any) => ({
      filename: m.metadata?.filename || "unknown",
      score: m.score || 0,
    })),
    decision: bestScore >= CONFIDENCE_THRESHOLD ? "USE_RAG" : "USE_GENERAL",
    confidenceLevel:
      bestScore >= 0.7 ? "high" : bestScore >= 0.5 ? "medium" : "low",
  };
  try {
    const dv = new Array(1024).fill(0);
    dv[0] = 0.0001;
    await index.upsert({
      records: [
        {
          id: `query-log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          values: dv,
          metadata: {
            type: "query_log",
            ...ragLog,
            topDocuments: JSON.stringify(ragLog.topDocuments),
          },
        },
      ],
    });
  } catch {
    /* non-fatal */
  }

  if (bestScore < CONFIDENCE_THRESHOLD) {
    return [await generateGeneralResponse(question, conversationHistory), []];
  }

  const contextObjects = relevantContexts
    .map((m: any) =>
      m.metadata?.text && m.metadata?.filename
        ? { text: m.metadata.text, filename: m.metadata.filename }
        : null,
    )
    .filter(Boolean) as { text: string; filename: string }[];
  if (duckDuckGoContext)
    contextObjects.unshift({
      text: duckDuckGoContext.text,
      filename: duckDuckGoContext.filename,
    });

  const contextStr = constructContext(contextObjects);
  const payload = createPayload(question, contextStr, conversationHistory);
  const openrouter = getOpenRouter();
  console.debug(
    "[ragQuery] model:",
    process.env.OPENROUTER_MODEL,
    "messages:",
    payload.messages.length,
  );
  let ragStream: Stream<ChatCompletionChunk>;
  try {
    ragStream = await openrouter.stream(
      {
        messages: payload.messages,
        max_tokens: payload.max_tokens,
        temperature: payload.temperature,
      },
      {
        posthogDistinctId,
        provider: { order: ["Chutes"] },
      },
    );
  } catch (err) {
    console.error("[ragQuery] OpenRouter SDK error:", err);
    throw err;
  }

  let enhancedContexts = contexts;
  if (duckDuckGoContext) {
    enhancedContexts = [
      {
        id: `ddg-${keyword}`,
        score: 1.0,
        values: [],
        metadata: {
          chunk_idx: -1,
          filename: `🌐 ${duckDuckGoContext.source}`,
          text: duckDuckGoContext.text,
          source: duckDuckGoContext.source,
        },
      },
      ...contexts,
    ];
  }
  return [ragStream, enhancedContexts];
}

// ──────────────────────────────────────────────
// App Router POST handler — SSE via TransformStream
// ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { question, history = [] } = body;

  if (!question) {
    return new Response(JSON.stringify({ message: "Question is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const sendSSE = (data: object) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

  // Run the async work in the background — must NOT await before returning the Response
  (async () => {
    try {
      // Process conversation history
      let conversationHistory = "";
      let metrics: ConversationMetrics = {
        originalMessageCount: 0,
        prunedMessageCount: 0,
        totalCharsOriginal: 0,
        totalCharsPruned: 0,
        compressionRatio: 1,
        hasSummary: false,
        shouldSuggestRestart: false,
      };

      if (history.length > 0) {
        const messages: ConversationMessage[] = history.map(
          (msg: { role: string; content: string }) => ({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.content,
            timestamp: Date.now(),
          }),
        );
        const prunedHistory = pruneConversationHistory(messages, question);
        metrics = calculateConversationMetrics(messages, prunedHistory);
        conversationHistory = formatHistoryForModel(prunedHistory);
      }

      // Extract posthog distinct ID from request headers
      const posthogDistinctId =
        req.headers.get("x-posthog-distinct-id") || "anonymous";

      // Classify query
      const classification = await classifyQuery(question, posthogDistinctId);
      let chunkStream: Stream<ChatCompletionChunk>;
      let contexts: any[] = [];
      let usedRAG = false;

      if (classification.needsRAG) {
        usedRAG = true;
        sendSSE({
          type: "web_search_loading",
          message: "Searching web for additional context...",
        });
        const [stream, ragContexts] = await ragQuery(
          question,
          conversationHistory,
          sendSSE,
          posthogDistinctId,
        );
        chunkStream = stream;
        contexts = ragContexts;
      } else {
        usedRAG = false;
        sendSSE({
          type: "classification",
          usedRAG: false,
          reasoning: classification.reasoning,
        });
        // Log GENERAL query to Pinecone
        try {
          const dv = new Array(1024).fill(0);
          dv[0] = 0.0001;
          await index.upsert({
            records: [
              {
                id: `query-log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                values: dv,
                metadata: {
                  type: "query_log",
                  timestamp: new Date().toISOString(),
                  question,
                  bestScore: 0,
                  totalMatches: 0,
                  relevantMatches: 0,
                  matchesAbove06: 0,
                  matchesAbove05: 0,
                  matchesAbove04: 0,
                  topDocuments: "[]",
                  decision: "USE_GENERAL",
                  confidenceLevel: "n/a",
                },
              },
            ],
          });
        } catch {
          /* non-fatal */
        }
        chunkStream = await generateGeneralResponse(
          question,
          conversationHistory,
          posthogDistinctId,
        );
        contexts = [];
      }

      // Emit contexts + metrics before streaming tokens
      sendSSE({ type: "contexts", contexts, usedRAG });
      sendSSE({ type: "metrics", metrics });

      // Iterate typed chunks — no SSE byte parsing needed
      for await (const chunk of chunkStream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) sendSSE({ type: "token", content });
      }
      sendSSE({ type: "done" });
    } catch (err) {
      console.error("[POST /api/chutes] unhandled error:", err);
      sendSSE({ type: "error", error: String(err) });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
