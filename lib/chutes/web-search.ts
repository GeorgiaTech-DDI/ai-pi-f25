import { getOpenRouter } from "../openrouter";

export interface DuckDuckGoResult {
  text: string;
  source: string;
  filename: string;
}

// ──────────────────────────────────────────────
// Keyword extraction via LLM
// ──────────────────────────────────────────────

export async function extractKeywordForDuckDuckGo(
  question: string,
  posthogDistinctId = "anonymous"
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
        maxTokens: 20,
        temperature: 0.1,
      },
      { posthogDistinctId }
    );
    const keywords = response.text?.trim() || "";
    if (keywords.length < 2) return "";
    return keywords.split(",")[0].trim().split(/\s+/).slice(0, 10).join(" ");
  } catch {
    return "";
  }
}

// ──────────────────────────────────────────────
// DuckDuckGo Instant Answer API
// Priority: Abstract > AbstractText > Definition > Answer > RelatedTopics
// ──────────────────────────────────────────────

export async function fetchDuckDuckGoContext(
  keyword: string
): Promise<DuckDuckGoResult | null> {
  if (!keyword) return null;
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
        (t: any) => t.Text && !t.Name && t.Text.length > 20
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
