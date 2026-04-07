import { Embeddings } from "deepinfra";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_FILE_SIZE = 4 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [".txt", ".md", ".pdf"];

function getFileExtension(filename: string) {
  return filename.toLowerCase().substring(filename.lastIndexOf("."));
}

export function isAllowedExtension(filename: string) {
  const fileExtension = getFileExtension(filename);
  return { allowed: ALLOWED_EXTENSIONS.includes(fileExtension), fileExtension };
}

export async function parseFileFromBuffer(
  buffer: Buffer | Uint8Array,
  extension: string
): Promise<string> {
  let content = "";

  switch (extension) {
    case ".txt":
    case ".md":
      content = new TextDecoder().decode(buffer);
      break;

    case ".pdf":
      try {
        const pdfProxy = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdfProxy, { mergePages: true });
        content = text;
        if (!content?.trim()) throw new Error("Empty PDF");
      } catch (error) {
        throw new Error("Failed to parse PDF");
      }
      break;
    default:
      throw new Error("Unsupported type");
  }
  return content;
}

export function splitTextIntoChunks(
  text: string,
  maxChunkSize: number,
  overlap: number
): Array<{ text: string; start: number; end: number }> {
  const chunks: Array<{ text: string; start: number; end: number }> = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    chunks.push({ text: text.slice(start, end), start, end });
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (process.env.DEEPINFRA_API_KEY) {
    const client = new Embeddings(
      "intfloat/multilingual-e5-large",
      process.env.DEEPINFRA_API_KEY
    );
    const output: any = await client.generate({
      inputs: texts.map((t) => `passage: ${t}`),
    });
    if (!output || !Array.isArray(output.embeddings))
      throw new Error("DeepInfra returned invalid embeddings response");
    return output.embeddings as number[][];
  }
  const hfApiUrl =
    process.env.HF_API_URL || "https://api-inference.huggingface.co";
  const hfApiKey = process.env.HF_API_KEY;
  if (!hfApiKey) throw new Error("No embedding provider configured");
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${hfApiKey}`,
    "Content-Type": "application/json",
  } as const;
  const embeddings: number[][] = [];
  for (const text of texts) {
    const response = await fetch(hfApiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: `passage: ${text}` }),
    });
    if (!response.ok)
      throw new Error(`Hugging Face API error: ${response.status}`);
    const result = await response.json();
    if (!Array.isArray(result))
      throw new Error("Unexpected embedding format from Hugging Face");
    embeddings.push(result);
  }
  return embeddings;
}
