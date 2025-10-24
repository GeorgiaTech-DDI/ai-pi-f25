import { Pinecone } from "@pinecone-database/pinecone";
import { Embeddings } from "deepinfra";
import type { NextApiRequest, NextApiResponse } from "next";
import { validateAzureToken } from "../../lib/auth";

// Configuration constants
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB in bytes (Vercel limit is 4.5MB, stay under)
const ALLOWED_EXTENSIONS = ['.txt', '.md', '.pdf'];

// Lazy Pinecone initialization (only initialize when needed, after env var validation)
let pineconeInstance: Pinecone | null = null;
let indexInstance: any = null;

function getPineconeIndex() {
  if (!pineconeInstance) {
    pineconeInstance = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || "",
    });
    indexInstance = pineconeInstance.index(process.env.PINECONE_INDEX_NAME || "rag-embeddings");
  }
  return indexInstance;
}

// Embedding helpers (DeepInfra preferred, fallback to Hugging Face Inference API)
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // Prefer DeepInfra if configured
  if (process.env.DEEPINFRA_API_KEY) {
    const client = new Embeddings(
      "intfloat/multilingual-e5-large",
      process.env.DEEPINFRA_API_KEY,
    );
    const body = { inputs: texts.map((t) => `passage: ${t}`) };
    const output: any = await client.generate(body);
    if (!output || !Array.isArray(output.embeddings)) {
      throw new Error("DeepInfra returned invalid embeddings response");
    }
    return output.embeddings as number[][];
  }

  // Fallback to Hugging Face Inference API
  const hfApiUrl = process.env.HF_API_URL || "https://api-inference.huggingface.co";
  const hfApiKey = process.env.HF_API_KEY;
  if (!hfApiKey) {
    throw new Error("No embedding provider configured (set DEEPINFRA_API_KEY or HF_API_KEY)");
  }

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
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    if (!Array.isArray(result)) {
      throw new Error("Unexpected embedding format from Hugging Face");
    }
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
}

interface PineconeFile {
  id: string;
  metadata: FileMetadata;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('🔍 Files API called:', req.method, req.url);
    
    // ⚙️ CONFIGURATION CHECK - Validate environment variables
    if (!process.env.PINECONE_API_KEY) {
      console.error('❌ PINECONE_API_KEY is not configured');
      return res.status(500).json({ 
        error: "Server configuration error: PINECONE_API_KEY is missing. Please configure Pinecone in Vercel environment variables." 
      });
    }

    if (!process.env.DEEPINFRA_API_KEY && !process.env.HF_API_KEY) {
      console.error('❌ No embedding provider configured');
      return res.status(500).json({ 
        error: "Server configuration error: No embedding provider configured. Set DEEPINFRA_API_KEY or HF_API_KEY." 
      });
    }

    // 🔒 AUTHENTICATION CHECK - Validate Azure AD token
    const user = await validateAzureToken(req);
    
    if (!user) {
      console.log('🔒 Unauthorized API access attempt to /api/files');
      return res.status(401).json({ 
        error: "Unauthorized - Please log in with a @gatech.edu account" 
      });
    }

    console.log(`✅ Authenticated user ${user.email} accessing /api/files`);

    const { method } = req;

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
    console.error("❌ CRITICAL ERROR in Files API handler:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Stack trace:", errorStack);
    
    // Ensure we ALWAYS return JSON
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: `API handler error: ${errorMessage}`,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      });
    }
  }
}

async function handleGetFiles(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Query Pinecone to get all files (using a special query to get file metadata)
    const index = getPineconeIndex();
    const queryResponse = await index.query({
      vector: new Array(1024).fill(0), // Dummy vector for metadata query (matches model dim)
      topK: 1000, // Get all files
      includeMetadata: true,
      filter: {
        type: "file_metadata"
      }
    });

    const files: PineconeFile[] = queryResponse.matches.reduce((acc: PineconeFile[], match: any) => {
      const meta = match.metadata as any;
      if (meta && meta.type === "file_metadata") {
        acc.push({ id: match.id, metadata: meta as FileMetadata });
      }
      return acc;
    }, []);

    return res.status(200).json({ files });
  } catch (error) {
    console.error("Error fetching files:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch files";
    
    // Check for common Pinecone errors
    if (errorMessage.includes("Index") && errorMessage.includes("not found")) {
      return res.status(500).json({ 
        error: `Pinecone index '${process.env.PINECONE_INDEX_NAME || "rag-embeddings"}' not found. Please create it in Pinecone Console with 1024 dimensions.` 
      });
    }
    
    return res.status(500).json({ error: `Failed to fetch files: ${errorMessage}` });
  }
}

async function handleUploadFile(req: NextApiRequest, res: NextApiResponse) {
  const { filename, content, description } = req.body;

  if (!filename || !content) {
    return res.status(400).json({ error: "Filename and content are required" });
  }

  // 🔒 VALIDATION 1: File size limit (5MB)
  if (content.length > MAX_FILE_SIZE) {
    const sizeMB = (content.length / (1024 * 1024)).toFixed(2);
    const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    console.log(`❌ File too large: ${sizeMB}MB (max: ${maxSizeMB}MB)`);
    return res.status(413).json({ 
      error: `File too large (${sizeMB}MB). Maximum size is ${maxSizeMB}MB` 
    });
  }

  // 🔒 VALIDATION 2: File type validation
  const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    console.log(`❌ Invalid file type: ${fileExtension}`);
    return res.status(400).json({ 
      error: `File type not allowed. Accepted types: ${ALLOWED_EXTENSIONS.join(', ')}` 
    });
  }

  // 🔒 VALIDATION 3: PDF files not yet supported
  if (fileExtension === '.pdf') {
    console.log(`❌ PDF upload attempted (not yet supported)`);
    return res.status(400).json({ 
      error: 'PDF support is not yet implemented. Please convert to .txt or .md format.' 
    });
  }

  try {
    // 🔒 VALIDATION 4: Check for duplicate filename
    const index = getPineconeIndex();
    const existingFiles = await index.query({
      vector: new Array(1024).fill(0),
      topK: 1,
      includeMetadata: true,
      filter: {
        type: "file_metadata",
        filename: filename
      }
    });

    if (existingFiles.matches.length > 0) {
      console.log(`❌ Duplicate file: ${filename}`);
      return res.status(409).json({ 
        error: `File "${filename}" already exists. Please delete it first or choose a different name.` 
      });
    }

    console.log(`✅ File validations passed for: ${filename}`);

    // Split content into chunks (similar to existing implementation)
    const chunks = splitTextIntoChunks(content, 1000, 200);
    
    // Generate embeddings for each chunk
    const chunkTexts = chunks.map((chunk) => chunk.text);
    const embeddingsArray = await generateEmbeddings(chunkTexts);
    
    // Prepare vectors for Pinecone
    const vectors = chunks.map((chunk, index) => ({
      id: `${filename}_chunk_${index}`,
      values: embeddingsArray[index],
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
      // Use the same dimension as the embedding model (e5-large: 1024)
      values: new Array(1024).fill(0),
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
    const index = getPineconeIndex();
    const queryResponse = await index.query({
      vector: new Array(1024).fill(0),
      topK: 1000,
      includeMetadata: true,
      filter: {
        filename: filename
      }
    });

    // Extract all IDs to delete
    const idsToDelete = queryResponse.matches.map((match: any) => match.id);

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
