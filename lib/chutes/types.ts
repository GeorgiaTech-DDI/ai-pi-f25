// ──────────────────────────────────────────────
// Conversation types
// ──────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  contexts?: any[];
}

export interface PrunedHistory {
  recentMessages: ConversationMessage[];
  summaryContext?: string;
  totalChars: number;
}

export interface ConversationMetrics {
  originalMessageCount: number;
  prunedMessageCount: number;
  totalCharsOriginal: number;
  totalCharsPruned: number;
  compressionRatio: number;
  hasSummary: boolean;
  shouldSuggestRestart: boolean;
}

// ──────────────────────────────────────────────
// History config
// ──────────────────────────────────────────────

export const HISTORY_CONFIG = {
  MAX_RECENT_MESSAGES: 8,
  MAX_TOTAL_CHARS: 5000,
  MIN_RELEVANCE_SCORE: 0.3,
  SUMMARY_THRESHOLD: 10,
} as const;

// ──────────────────────────────────────────────
// RAG config
// ──────────────────────────────────────────────

export const CONFIDENCE_THRESHOLD = 0.6;
export const EMBEDDING_DIM = 1024;
export const EMBEDDING_MAX_CHARS = 350;

// ──────────────────────────────────────────────
// System prompts
// ──────────────────────────────────────────────

export const SYSTEM_PROMPT_RAG = `You are AI PI, a helpful assistant for the Invention Studio at Georgia Tech, created by the MATRIX Lab team.

Guidelines:
- Answer questions naturally and conversationally
- Use the provided context when relevant to the user's question
- If context doesn't contain the answer, say "I don't know" or give your best guess with "I think that..."
- Don't repeat yourself or use template responses
- Don't announce your name or creator unless specifically asked
- Focus on being helpful and direct
- If the user's question is unclear or off-topic, ask for clarification

Respond naturally to the conversation flow and the user's current question.`;

export const SYSTEM_PROMPT_GENERAL = `You are AI PI, a helpful assistant for the Invention Studio at Georgia Tech, created by the MATRIX Lab team.

Guidelines:
- Answer questions naturally and conversationally using your general knowledge
- Be friendly and helpful
- If asked about specific Invention Studio details (equipment, policies, hours), politely mention you need more specific information
- Don't make up specific studio policies or details
- Keep responses concise and helpful
- Don't announce your name or creator unless specifically asked`;

export const SYSTEM_PROMPT_CLASSIFIER = `You are a query classifier for the Invention Studio chatbot at Georgia Tech.

The Invention Studio is a makerspace with equipment like 3D printers, laser cutters, CNC machines, etc.

Classify the user's question as GENERAL or RAG:
- GENERAL: Simple greetings, farewells, gratitude, general knowledge questions, conversational responses
- RAG: Questions about Invention Studio equipment, policies, procedures, hours, training, materials, or anything requiring studio-specific information

Respond with ONLY valid JSON in this exact format:
{"classification": "GENERAL", "reasoning": "brief explanation"}
OR
{"classification": "RAG", "reasoning": "brief explanation"}`;

// ──────────────────────────────────────────────
// AI SDK stream type alias
// ──────────────────────────────────────────────

import { getOpenRouter } from "../openrouter";
export type OpenRouterStream = Awaited<
  ReturnType<ReturnType<typeof getOpenRouter>["stream"]>
>;
