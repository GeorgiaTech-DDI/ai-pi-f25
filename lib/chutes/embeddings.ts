import { Embeddings } from "deepinfra";

// ──────────────────────────────────────────────
// Ollama health check
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

// ──────────────────────────────────────────────
// Embedding provider waterfall: Ollama → DeepInfra → HuggingFace
// ──────────────────────────────────────────────

export async function embedDocs(docs: string[]): Promise<number[][]> {
  const prefixedDocs = docs.map((d) => `query: ${d}`);

  // 1. Try local Ollama first (lowest latency, no cost)
  if (await isOllamaRunning()) {
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

  // 2. Fall back to DeepInfra
  if (process.env.DEEPINFRA_API_KEY) {
    const client = new Embeddings(
      "intfloat/multilingual-e5-large",
      process.env.DEEPINFRA_API_KEY,
    );
    const output = await client.generate({ inputs: docs });
    return output.embeddings;
  }

  // 3. Fall back to HuggingFace Inference API (serial — HF doesn't support batch)
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
