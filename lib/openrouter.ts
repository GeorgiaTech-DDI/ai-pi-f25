import { OpenAI } from "@posthog/ai";
import { getPostHogClient } from "./posthog-server";
import type { Stream } from "openai/streaming";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";

/** Params for stream() — stream:true is enforced internally, callers must not pass it */
export type StreamParams = Omit<ChatCompletionCreateParamsStreaming, "stream">;

/**
 * Makes `model` optional in any params type — the OpenRouter instance
 * will fall back to the defaultModel set at construction time.
 */
export type WithOptionalModel<T extends { model: string }> = Omit<
  T,
  "model"
> & { model?: string };

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type CompletionOptions = {
  /** PostHog distinct ID for LLM analytics (defaults to "anonymous") */
  posthogDistinctId?: string;
  /** OpenRouter provider routing, e.g. { order: ["Chutes"] } */
  provider?: { order: string[] };
};

// ──────────────────────────────────────────────
// OpenRouter class
// ──────────────────────────────────────────────

export class OpenRouter {
  private static _instance: OpenRouter | null = null;
  private readonly client: OpenAI;
  /** Resolved once at construction — callers don't need to repeat it */
  readonly defaultModel: string;

  private constructor() {
    this.defaultModel = process.env.OPENROUTER_MODEL ?? "";
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY || "",
      posthog: getPostHogClient(),
      defaultHeaders: {
        "HTTP-Referer":
          process.env.PUBLIC_SITE_URL || "https://matrixlab.gatech.edu",
        "X-Title": "Matrix Lab AI",
      },
    });
  }

  static getInstance(): OpenRouter {
    if (!OpenRouter._instance) {
      OpenRouter._instance = new OpenRouter();
    }
    return OpenRouter._instance;
  }

  // ── Private helpers ──────────────────────────

  private buildExtraBody(options?: CompletionOptions): object | undefined {
    if (!options?.provider) return undefined;
    return { provider: options.provider };
  }

  private distinctId(options?: CompletionOptions): string {
    return options?.posthogDistinctId ?? "anonymous";
  }

  // ── Public API ───────────────────────────────

  /**
   * Non-streaming chat completion.
   * `model` is optional — falls back to `defaultModel`.
   */
  async complete(
    params: WithOptionalModel<ChatCompletionCreateParamsNonStreaming>,
    options?: CompletionOptions,
  ): Promise<ChatCompletion> {
    const extra_body = this.buildExtraBody(options);
    return this.client.chat.completions.create(
      { model: this.defaultModel, ...params, stream: false },
      {
        posthogDistinctId: this.distinctId(options),
        ...(extra_body ? { extra_body } : {}),
      },
    );
  }

  /**
   * Streaming chat completion — returns a typed async iterable of chunks.
   * `model` is optional — falls back to `defaultModel`.
   * Callers should NOT pass `stream` in params; it is enforced here.
   */
  async stream(
    params: WithOptionalModel<StreamParams>,
    options?: CompletionOptions,
  ): Promise<Stream<ChatCompletionChunk>> {
    const extra_body = this.buildExtraBody(options);
    return this.client.chat.completions.create(
      { model: this.defaultModel, ...params, stream: true as const },
      {
        posthogDistinctId: this.distinctId(options),
        ...(extra_body ? { extra_body } : {}),
      },
    );
  }

  /**
   * Escape hatch — exposes the raw @posthog/ai OpenAI client.
   */
  get rawClient(): OpenAI {
    return this.client;
  }
}

export function getOpenRouter(): OpenRouter {
  return OpenRouter.getInstance();
}
