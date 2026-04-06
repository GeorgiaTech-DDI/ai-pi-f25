import { Pinecone } from "@pinecone-database/pinecone";
import { Embeddings } from "deepinfra";
import { auth } from "../../../lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { del, put } from "@vercel/blob";

// API Route Configuration - Increase body size limit for file uploads
export const maxDuration = 60;

// Dynamic import for pdf-parse (CommonJS module)
async function parsePDF(
  buffer: Buffer
): Promise<{ text: string; numpages: number; info: any }> {
  // @ts-ignore - pdf-parse types are not compatible with ES modules
  const pdfParse = (await import("pdf-parse")).default;
  // @ts-ignore
  return await pdfParse(buffer);
}

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".txt", ".md", ".pdf"];

let pineconeInstance: Pinecone | null = null;
let indexInstance: any = null;
function getPineconeIndex() {
  if (!pineconeInstance) {
    pineconeInstance = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || "",
    });
    indexInstance = pineconeInstance.index(
      process.env.PINECONE_INDEX_NAME || "rag-embeddings"
    );
  }
  return indexInstance;
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
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

interface FileMetadata {
  filename: string;
  uploadDate: string;
  fileSize: number;
  chunkCount: number;
  description?: string;
  blobUrl?: string;
}

interface PineconeFile {
  id: string;
  metadata: FileMetadata;
}

function splitTextIntoChunks(
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

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  let errorMessage: { type: "general" | "auth"; message: string } | null = null;
  if (!process.env.PINECONE_API_KEY) {
    errorMessage = {
      type: "general",
      message: "Server configuration error: PINECONE_API_KEY is missing.",
    };
  } else if (!process.env.DEEPINFRA_API_KEY && !process.env.HF_API_KEY) {
    errorMessage = {
      type: "general",
      message: "Server configuration error: No embedding provider configured.",
    };
  } else if (!session) {
    errorMessage = {
      type: "auth",
      message: "Unauthorized - Please log in with a @gatech.edu account",
    };
  }

  if (errorMessage) {
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage.type === "auth" ? 401 : 500 }
    );
  }

  // TODO: resolve the any typing using correct Pinecone SDK
  // get all files from Pinecone via a dummy vector query
  const index = getPineconeIndex();
  const dummyVector = new Array(1024).fill(0);
  dummyVector[0] = 0.0001;

  // make the query
  const queryResponse = await index.query({
    vector: dummyVector,
    topK: 1000,
    includeMetadata: true,
    filter: { type: "file_metadata" },
  });

  // convert query response to files
  const files: PineconeFile[] = [];
  for (const match of queryResponse.matches) {
    const meta = match.metadata as any;
    if (meta?.type === "file_metadata") {
      files.push({ id: match.id, metadata: meta as FileMetadata });
    }
  }

  return NextResponse.json({ files }, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.PINECONE_API_KEY)
      return NextResponse.json(
        { error: "Server configuration error: PINECONE_API_KEY is missing." },
        { status: 500 }
      );
    if (!process.env.DEEPINFRA_API_KEY && !process.env.HF_API_KEY)
      return NextResponse.json(
        {
          error:
            "Server configuration error: No embedding provider configured.",
        },
        { status: 500 }
      );

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session)
      return NextResponse.json(
        { error: "Unauthorized - Please log in with a @gatech.edu account" },
        { status: 401 }
      );

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const description = formData.get("description") as string | null;

    if (!file)
      return NextResponse.json({ error: "File is required" }, { status: 400 });

    const filename = file.name;

    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      return NextResponse.json(
        {
          error: `File too large: ${sizeMB}MB exceeds the ${maxSizeMB}MB limit.`,
        },
        { status: 413 }
      );
    }

    const fileExtension = filename
      .toLowerCase()
      .substring(filename.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        {
          error: `File type not allowed. Accepted types: ${ALLOWED_EXTENSIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let textContent: string;
    if (fileExtension === ".pdf") {
      try {
        const pdfData = await parsePDF(buffer);
        textContent = pdfData.text;
        if (!textContent?.trim())
          return NextResponse.json(
            { error: "PDF file contains no extractable text." },
            { status: 400 }
          );
      } catch {
        return NextResponse.json(
          { error: "Failed to parse PDF file." },
          { status: 400 }
        );
      }
    } else {
      textContent = buffer.toString("utf-8");
    }

    const index = getPineconeIndex();
    const dummyVector = new Array(1024).fill(0);
    dummyVector[0] = 0.0001;
    const existingFiles = await index.query({
      vector: dummyVector,
      topK: 1,
      includeMetadata: true,
      filter: { type: "file_metadata", filename },
    });
    if (existingFiles.matches.length > 0)
      return NextResponse.json(
        { error: `File "${filename}" already exists.` },
        { status: 409 }
      );

    const chunks = splitTextIntoChunks(textContent, 1000, 200);
    const embeddingsArray = await generateEmbeddings(chunks.map((c) => c.text));
    const vectors = chunks.map((chunk, idx) => ({
      id: `${filename}_chunk_${idx}`,
      values: embeddingsArray[idx],
      metadata: {
        text: chunk.text,
        filename,
        chunkIndex: idx,
        type: "document_chunk",
      },
    }));
    const metadataVector = new Array(1024).fill(0);
    metadataVector[0] = 0.0001;

    // atomic uploads
    let uploadedBlobUrl = null;
    try {
      const blob = await put(`documents/${filename}`, file, {
        access: "public",
      });
      uploadedBlobUrl = blob.url;

      await index.upsert([
        {
          id: `file_metadata_${filename}`,
          values: metadataVector,
          metadata: {
            type: "file_metadata",
            filename,
            uploadDate: new Date().toISOString(),
            fileSize: textContent.length,
            chunkCount: chunks.length,
            blobUrl: uploadedBlobUrl,
          },
        },
      ]);
    } catch (error) {
      if (uploadedBlobUrl) {
        await del(uploadedBlobUrl);
      }

      console.error("Atomic operation failed, rolled back blob upload:", error);
      throw new Error("Failed to process document. Storage was cleaned up.");
    }

    return NextResponse.json({
      success: true,
      filename,
      chunkCount: chunks.length,
      message: "File uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");
    if (!filename)
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );

    const index = getPineconeIndex();
    const dummyVector = new Array(1024).fill(0);
    dummyVector[0] = 0.0001;
    const queryResponse = await index.query({
      vector: dummyVector,
      topK: 1000,
      includeMetadata: true,
      filter: { filename },
    });
    const idsToDelete = queryResponse.matches.map((match: any) => match.id);
    if (idsToDelete.length === 0)
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    await index.deleteMany(idsToDelete);
    return NextResponse.json({
      success: true,
      filename,
      deletedCount: idsToDelete.length,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
