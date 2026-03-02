import { OpenAI } from "@posthog/ai";
import { getPostHogClient } from "./posthog-server";

let openRouterClient: OpenAI | null = null;

export function getOpenRouterClient() {
  if (!openRouterClient) {
    openRouterClient = new OpenAI({
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
  return openRouterClient;
}
