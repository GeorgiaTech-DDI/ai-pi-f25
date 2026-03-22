import { NextRequest } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import crypto from "crypto";
import { processHistory } from "../../../lib/chutes/history";
import {
  classifyQuery,
  generateGeneralResponse,
  logQueryToPinecone,
  ragQuery,
} from "../../../lib/chutes/rag";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages: { role: string; parts: { type: string; text?: string }[] }[] =
    body.messages ?? [];

  // Extract the last user message text as the question
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const question = lastUserMsg?.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!question) {
    return new Response(JSON.stringify({ message: "Question is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // All messages except the last user message become history
  const historyMessages = messages.slice(0, -1);
  const history = historyMessages.map((m) => ({
    role: m.role,
    content: m.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join(""),
  }));

  const posthogDistinctId =
    req.headers.get("x-posthog-distinct-id") ?? "anonymous";
  const traceId = crypto.randomUUID();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // 1. Process conversation history
      const { conversationHistory, metrics } = processHistory(
        history,
        question
      );

      // 2. Classify query
      const classification = await classifyQuery(question, posthogDistinctId);

      let llmStream;
      let contexts: any[] = []; // TODO: fix typing

      if (classification.needsRAG) {
        // 3a. RAG path — emit loading indicator, then run full pipeline
        writer.write({
          type: "data-web_search_loading",
          data: { message: "Searching web for additional context..." },
          transient: true,
        });
        const result = await ragQuery(
          question,
          conversationHistory,
          writer,
          posthogDistinctId,
          traceId
        );
        llmStream = result.stream;
        contexts = result.contexts;
      } else {
        // 3b. General path — log and generate directly
        writer.write({
          type: "data-classification",
          data: { usedRAG: false, reasoning: classification.reasoning },
          transient: true,
        });
        await logQueryToPinecone(question, "USE_GENERAL");
        llmStream = await generateGeneralResponse(
          question,
          conversationHistory,
          posthogDistinctId,
          traceId
        );
      }

      // 4. Emit metadata before tokens arrive
      writer.write({
        type: "data-contexts",
        data: { contexts, usedRAG: classification.needsRAG, traceId },
        transient: true,
      });
      writer.write({
        type: "data-metrics",
        data: { metrics },
        transient: true,
      });

      // 5. Pipe the LLM stream
      writer.merge(llmStream.toUIMessageStream());
    },
    onError: (err) => {
      console.error("[POST /api/chutes] unhandled error:", err);
      return String(err);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
