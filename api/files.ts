import { Pinecone } from "@pinecone-database/pinecone";
import { Embeddings } from "deepinfra";
import type { NextApiRequest, NextApiResponse } from "next";

// Initialize Pinecone Client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});
const index = pinecone.index(process.env.PINECONE_INDEX_NAME || "rag-embeddings");

// Initialize DeepInfra embeddings
const embeddings = new Embeddings({
  apiKey: process.env.HF_API_KEY || "",
  model: "jeffh/intfloat-multilingual-e5-large:f16",
  baseURL: process.env.HF_API_URL || "https://api-inference.huggingface.co",
});

interface FileMetadata {
  filename: string;
  uploadDate: string;
  fileSize: number;
  chunkCount: number;
  description?: string;
}

interface PineconeFile {
  id: string;
  metadata: FileMetadata;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  try {
    switch (method) {
      case "GET":
        return await handleGetFiles(req, res);
      case "POST":
        return await handleUploadFile(req, res);
      case "DELETE":
        return await handleDeleteFile(req, res);
      default:
        res.setHeader("Allow", ["GET", "POST", "DELETE"]);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error("Files API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGetFiles(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Query Pinecone to get all files (using a special query to get file metadata)
    const queryResponse = await index.query({
      vector: new Array(1536).fill(0), // Dummy vector for metadata query
      topK: 1000, // Get all files
      includeMetadata: true,
      filter: {
        type: "file_metadata"
      }
    });

    const files: PineconeFile[] = queryResponse.matches
      .filter(match => match.metadata?.type === "file_metadata")
      .map(match => ({
        id: match.id,
        metadata: match.metadata as FileMetadata
      }));

    return res.status(200).json({ files });
  } catch (error) {
    console.error("Error fetching files:", error);
    return res.status(500).json({ error: "Failed to fetch files" });
  }
}

async function handleUploadFile(req: NextApiRequest, res: NextApiResponse) {
  const { filename, content, description } = req.body;

  if (!filename || !content) {
    return res.status(400).json({ error: "Filename and content are required" });
  }

  try {
    // Split content into chunks (similar to existing implementation)
    const chunks = splitTextIntoChunks(content, 1000, 200);
    
    // Generate embeddings for each chunk
    const chunkTexts = chunks.map(chunk => chunk.text);
    const embeddingsResponse = await embeddings.embedDocuments(chunkTexts);
    
    // Prepare vectors for Pinecone
    const vectors = chunks.map((chunk, index) => ({
      id: `${filename}_chunk_${index}`,
      values: embeddingsResponse.data[index],
      metadata: {
        text: chunk.text,
        filename,
        chunkIndex: index,
        type: "document_chunk"
      }
    }));

    // Add file metadata vector
    const fileMetadataVector = {
      id: `file_metadata_${filename}`,
      values: new Array(1536).fill(0), // Dummy vector for metadata
      metadata: {
        type: "file_metadata",
        filename,
        uploadDate: new Date().toISOString(),
        fileSize: content.length,
        chunkCount: chunks.length,
        description: description || ""
      }
    };

    // Upload to Pinecone
    await index.upsert([...vectors, fileMetadataVector]);

    return res.status(200).json({
      success: true,
      filename,
      chunkCount: chunks.length,
      message: "File uploaded successfully"
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return res.status(500).json({ error: "Failed to upload file" });
  }
}

async function handleDeleteFile(req: NextApiRequest, res: NextApiResponse) {
  const { filename } = req.query;

  if (!filename || typeof filename !== "string") {
    return res.status(400).json({ error: "Filename is required" });
  }

  try {
    // First, get all vectors for this file
    const queryResponse = await index.query({
      vector: new Array(1536).fill(0),
      topK: 1000,
      includeMetadata: true,
      filter: {
        filename: filename
      }
    });

    // Extract all IDs to delete
    const idsToDelete = queryResponse.matches.map(match => match.id);

    if (idsToDelete.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    // Delete all vectors for this file
    await index.deleteMany(idsToDelete);

    return res.status(200).json({
      success: true,
      filename,
      deletedCount: idsToDelete.length,
      message: "File deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    return res.status(500).json({ error: "Failed to delete file" });
  }
}

// Helper function to split text into chunks (reused from existing code)
function splitTextIntoChunks(text: string, maxChunkSize: number, overlap: number): Array<{ text: string; start: number; end: number }> {
  const chunks: Array<{ text: string; start: number; end: number }> = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    const chunkText = text.slice(start, end);
    
    chunks.push({
      text: chunkText,
      start,
      end
    });

    if (end === text.length) break;
    start = end - overlap;
  }

  return chunks;
}
