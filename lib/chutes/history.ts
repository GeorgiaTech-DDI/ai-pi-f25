import {
  ConversationMessage,
  PrunedHistory,
  ConversationMetrics,
  HISTORY_CONFIG,
} from "./types";

// ──────────────────────────────────────────────
// Internal helpers
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

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export function pruneConversationHistory(
  messages: ConversationMessage[],
  currentQuestion: string,
): PrunedHistory {
  void currentQuestion; // reserved for future relevance scoring
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

export function calculateConversationMetrics(
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

export function formatHistoryForModel(prunedHistory: PrunedHistory): string {
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
        const content = msg.content
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

export function extractEmbeddingContext(
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
// Convenience: process a raw history array from the request body
// ──────────────────────────────────────────────

export function processHistory(
  history: { role: string; content: string }[],
  question: string,
): { conversationHistory: string; metrics: ConversationMetrics } {
  const emptyMetrics: ConversationMetrics = {
    originalMessageCount: 0,
    prunedMessageCount: 0,
    totalCharsOriginal: 0,
    totalCharsPruned: 0,
    compressionRatio: 1,
    hasSummary: false,
    shouldSuggestRestart: false,
  };

  if (history.length === 0) {
    return { conversationHistory: "", metrics: emptyMetrics };
  }

  const messages: ConversationMessage[] = history.map((msg) => ({
    role: msg.role === "user" ? "user" : "assistant",
    content: msg.content,
    timestamp: Date.now(),
  }));

  const prunedHistory = pruneConversationHistory(messages, question);
  const metrics = calculateConversationMetrics(messages, prunedHistory);
  const conversationHistory = formatHistoryForModel(prunedHistory);

  return { conversationHistory, metrics };
}
