import { PDFParse, VerbosityLevel } from "pdf-parse";
import { Embeddings } from "deepinfra";

export const MAX_FILE_SIZE = 4 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [".txt", "  .md", ".pdf"];

function getFileExtension(filename: string) {
  return filename.toLowerCase().substring(filename.lastIndexOf("."));
}

export function isAllowedExtension(filename: string) {
  const fileExtension = getFileExtension(filename);
  return { allowed: ALLOWED_EXTENSIONS.includes(fileExtension), fileExtension };
}

export async function parseFile(file: File): Promise<string> {
  const { fileExtension } = isAllowedExtension(file.name);

  const arrayBuffer = await file.arrayBuffer();

  let content = "";
  switch (fileExtension) {
    case ".txt":
      content = Buffer.from(arrayBuffer).toString("utf-8");
      break;
    case ".md":
      content = Buffer.from(arrayBuffer).toString("utf-8");
      break;
    case ".pdf":
      const parser = new PDFParse({
        data: arrayBuffer,
        verbosity: VerbosityLevel.ERRORS,
      });
      try {
        const data = await parser.getText();
        content = data.text;
        if (!content?.trim())
          throw new Error("PDF file contains no extractable text.");
      } catch (error) {
        console.error("Failed to parse PDF file", error);
        throw new Error("Failed to parse PDF file.");
      } finally {
        await parser.destroy();
      }
      break;
    default:
      throw new Error(`Unsupported file type: ${fileExtension}`);
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
