import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, generateText, Output, type LanguageModel } from "ai";
import { withTracing } from "@posthog/ai";
import { getPostHogClient } from "./posthog-server";

export type CompletionOptions = {
  /** PostHog distinct ID for LLM analytics (defaults to "anonymous") */
  posthogDistinctId?: string;
  /** Custom PostHog trace ID for grouping */
  posthogTraceId?: string;
  /** OpenRouter specific: e.g. { order: ["Chutes"] } */
  provider?: { order: string[] };
};

export class OpenRouter {
  private static _instance: OpenRouter | null = null;
  private readonly provider;
  readonly defaultModel: string;

  private constructor() {
    if (!process.env.OPENROUTER_MODEL)
      throw new Error("Openrouter model is missing");

    this.defaultModel = process.env.OPENROUTER_MODEL;

    // Initialize the official OpenRouter AI SDK provider
    this.provider = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY || "",
      headers: {
        "HTTP-Referer":
          process.env.PUBLIC_SITE_URL || "https://matrixlab.gatech.edu",
        "X-Title": "Matrix Lab AI",
      },
    });
  }

  static getInstance(): OpenRouter {
    if (!OpenRouter._instance) OpenRouter._instance = new OpenRouter();
    return OpenRouter._instance;
  }

  /**
   * Internal helper to wrap the model with PostHog's tracing
   */
  private getTracedModel(
    modelId?: string,
    options?: CompletionOptions
  ): LanguageModel {
    const targetModel = modelId ?? this.defaultModel;

    // Create the model instance from the provider
    const model = this.provider(targetModel, {
      // Passes the specific OpenRouter provider routing logic
      ...(options?.provider
        ? { extraBody: { provider: options.provider } }
        : {}),
    });

    // Wrap with PostHog's withTracing to capture logs/metrics
    return withTracing(model, getPostHogClient(), {
      posthogDistinctId: options?.posthogDistinctId ?? "anonymous",
      posthogTraceId: options?.posthogTraceId,
    });
  }

  // ── Public API ───────────────────────────────

  /**
   * Non-streaming completion (Equivalent to complete)
   */
  async complete(params: any, options?: CompletionOptions) {
    const model = this.getTracedModel(params.model, options);
    return generateText({
      model,
      ...params,
    });
  }

  /**
   * Streaming completion
   */
  async stream(params: any, options?: CompletionOptions) {
    const model = this.getTracedModel(params.model, options);
    return streamText({
      model,
      ...params,
    });
  }

  /**
   * Structured object completion using Output specification
   */
  async generateObject<T>(
    params: any,
    output: Parameters<typeof Output.object>[0],
    options?: CompletionOptions
  ) {
    const model = this.getTracedModel(params.model, options);
    const { output: result } = await generateText({
      model,
      output: Output.object(output),
      ...params,
    });
    return result as T;
  }
}

export const getOpenRouter = () => OpenRouter.getInstance();
