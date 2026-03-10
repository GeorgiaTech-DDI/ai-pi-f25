import { Pinecone } from "@pinecone-database/pinecone";
import { jsonSchema } from "ai";
import type { UIMessageStreamWriter } from "ai";
import { getOpenRouter } from "../openrouter";
import { embedDocs } from "./embeddings";
import {
  extractKeywordForDuckDuckGo,
  fetchDuckDuckGoContext,
} from "./web-search";
import {
  CONFIDENCE_THRESHOLD,
  EMBEDDING_DIM,
  EMBEDDING_MAX_CHARS,
  SYSTEM_PROMPT_RAG,
  SYSTEM_PROMPT_GENERAL,
  SYSTEM_PROMPT_CLASSIFIER,
  type OpenRouterStream,
} from "./types";
import { extractEmbeddingContext } from "./history";

// ──────────────────────────────────────────────
// Pinecone singleton
// ──────────────────────────────────────────────

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || "" });
const index = pinecone.index(
  process.env.PINECONE_INDEX_NAME || "rag-embeddings",
);

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// ──────────────────────────────────────────────
// Context construction
// ──────────────────────────────────────────────

export function constructContext(
  contexts: Array<{ text: string; filename: string }>,
  maxSectionLen = 5000,
): string {
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

// ──────────────────────────────────────────────
// Message payload builder
// ──────────────────────────────────────────────

export function createPayload(
  question: string,
  contextStr: string,
  conversationHistory = "",
): { messages: ChatMessage[]; maxTokens: number; temperature: number } {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT_RAG },
  ];

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
  return { messages, maxTokens: 500, temperature: 0.75 };
}

// ──────────────────────────────────────────────
// Query classification
// ──────────────────────────────────────────────

export async function classifyQuery(
  question: string,
  posthogDistinctId = "anonymous",
): Promise<{ needsRAG: boolean; reasoning?: string }> {
  try {
    const openrouter = getOpenRouter();
    const result = await openrouter.generateObject<{
      classification: "GENERAL" | "RAG";
      reasoning: string;
    }>(
      {
        system: SYSTEM_PROMPT_CLASSIFIER,
        messages: [{ role: "user", content: question }],
        maxTokens: 100,
        temperature: 0.1,
      },
      {
        schema: jsonSchema<{
          classification: "GENERAL" | "RAG";
          reasoning: string;
        }>({
          type: "object",
          properties: {
            classification: { type: "string", enum: ["GENERAL", "RAG"] },
            reasoning: { type: "string" },
          },
          required: ["classification", "reasoning"],
          additionalProperties: false,
        }),
      },
      { posthogDistinctId },
    );
    return {
      needsRAG: result.classification === "RAG",
      reasoning: result.reasoning,
    };
  } catch {
    return {
      needsRAG: true,
      reasoning: "Classification error, defaulting to RAG",
    };
  }
}

// ──────────────────────────────────────────────
// Pinecone query logging (non-fatal)
// ──────────────────────────────────────────────

export async function logQueryToPinecone(
  question: string,
  decision: "USE_RAG" | "USE_GENERAL",
  ragDetails?: {
    bestScore: number;
    totalMatches: number;
    relevantMatches: number;
    matchesAbove06: number;
    matchesAbove05: number;
    matchesAbove04: number;
    topDocuments: { filename: string; score: number }[];
    confidenceLevel: "high" | "medium" | "low" | "n/a";
  },
): Promise<void> {
  try {
    const dv = new Array(EMBEDDING_DIM).fill(0);
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
            decision,
            bestScore: ragDetails?.bestScore ?? 0,
            totalMatches: ragDetails?.totalMatches ?? 0,
            relevantMatches: ragDetails?.relevantMatches ?? 0,
            matchesAbove06: ragDetails?.matchesAbove06 ?? 0,
            matchesAbove05: ragDetails?.matchesAbove05 ?? 0,
            matchesAbove04: ragDetails?.matchesAbove04 ?? 0,
            topDocuments: JSON.stringify(ragDetails?.topDocuments ?? []),
            confidenceLevel: ragDetails?.confidenceLevel ?? "n/a",
          },
        },
      ],
    });
  } catch {
    /* non-fatal */
  }
}

// ──────────────────────────────────────────────
// General (non-RAG) streaming response
// ──────────────────────────────────────────────

export async function generateGeneralResponse(
  question: string,
  conversationHistory = "",
  posthogDistinctId = "anonymous",
): Promise<OpenRouterStream> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT_GENERAL },
  ];
  if (conversationHistory?.trim())
    messages.push({ role: "user", content: conversationHistory });
  messages.push({ role: "user", content: question });

  const openrouter = getOpenRouter();
  return openrouter.stream(
    { messages, maxTokens: 500, temperature: 0.75 },
    { posthogDistinctId, provider: { order: ["Chutes"] } },
  );
}

// ──────────────────────────────────────────────
// Full RAG pipeline
// ──────────────────────────────────────────────

export interface RagQueryResult {
  stream: OpenRouterStream;
  contexts: any[];
}

export async function ragQuery(
  question: string,
  conversationHistory = "",
  dataStream: UIMessageStreamWriter,
  posthogDistinctId = "anonymous",
): Promise<RagQueryResult> {
  // 1. Build embedding context
  let textForEmbedding = extractEmbeddingContext(conversationHistory, question);
  if (textForEmbedding.length > EMBEDDING_MAX_CHARS)
    textForEmbedding = textForEmbedding.slice(-EMBEDDING_MAX_CHARS);

  // 2. Embed question and (optionally) context-enriched query
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
    queryVec.length !== EMBEDDING_DIM ||
    questionVec.length !== EMBEDDING_DIM
  )
    throw new Error("Unexpected embedding structure.");

  // 3. Web search (parallel with Pinecone would be ideal, but DDG keyword needs LLM)
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
  dataStream.write({
    type: "data-web_search_complete",
    data: {
      found: !!duckDuckGoContext,
      keyword,
      source: duckDuckGoContext?.source || null,
      error: !duckDuckGoContext,
    },
    transient: true,
  });

  // 4. Pinecone vector query
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

  // 5. Score and confidence check
  const relevantContexts = contexts.filter(
    (m: any) => m.score && m.score >= 0.25 && m.metadata?.text,
  );
  const bestScore =
    relevantContexts.length > 0
      ? Math.max(...relevantContexts.map((m: any) => m.score || 0))
      : 0;

  // 6. Log to Pinecone
  await logQueryToPinecone(
    question,
    bestScore >= CONFIDENCE_THRESHOLD ? "USE_RAG" : "USE_GENERAL",
    {
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
      confidenceLevel:
        bestScore >= 0.7 ? "high" : bestScore >= 0.5 ? "medium" : "low",
    },
  );

  // 7. Fall back to general if no confident match
  if (bestScore < CONFIDENCE_THRESHOLD) {
    return {
      stream: await generateGeneralResponse(
        question,
        conversationHistory,
        posthogDistinctId,
      ),
      contexts: [],
    };
  }

  // 8. Build context string and call LLM
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

  const ragStream = await openrouter.stream(
    {
      messages: payload.messages,
      maxTokens: payload.maxTokens,
      temperature: payload.temperature,
    },
    { posthogDistinctId, provider: { order: ["Chutes"] } },
  );

  // 9. Build enhanced context list (prepend DDG result)
  const enhancedContexts = duckDuckGoContext
    ? [
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
      ]
    : contexts;

  return { stream: ragStream, contexts: enhancedContexts };
}
