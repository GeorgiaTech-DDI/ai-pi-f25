import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_EXTENSIONS,
  generateEmbeddings,
  isAllowedExtension,
  MAX_FILE_SIZE,
  parseFileFromBuffer,
  splitTextIntoChunks,
} from "../utils";
import { auth } from "@/lib/auth";
import { getPinecone } from "@/lib/pinecone";
import { del, getDownloadUrl, put } from "@vercel/blob";
import { randomUUID } from "crypto";

// bypass server action file limit
export async function POST(req: NextRequest) {
  try {
    // setup
    if (!process.env.PINECONE_API_KEY) {
      console.error("Server configuration error: PINECONE_API_KEY is missing.");
      return NextResponse.json(
        { error: "Server configuration error: PINECONE_API_KEY is missing." },
        { status: 500 }
      );
    }

    if (!process.env.DEEPINFRA_API_KEY && !process.env.HF_API_KEY) {
      console.error(
        "Server configuration error: No embedding provider configured."
      );
      return NextResponse.json(
        {
          error:
            "Server configuration error: No embedding provider configured.",
        },
        { status: 500 }
      );
    }

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      console.error("Unauthorized user");
      return NextResponse.json(
        { error: "Unauthorized - Please log in with a @gatech.edu account" },
        { status: 401 }
      );
    }

    // get file and description from form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const description = formData.get("description") as string | null;

    if (!file) {
      console.error("File is required", JSON.stringify(formData, null, 2));
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const { name: filename, size: fileSize } = file;

    // check file size
    if (fileSize > MAX_FILE_SIZE) {
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      const isPDF = filename.toLowerCase().endsWith(".pdf");
      console.error("File too large", JSON.stringify(file, null, 2));
      return NextResponse.json(
        {
          error: isPDF
            ? `PDF file too large: ${sizeMB}MB encoded exceeds the ${maxSizeMB}MB limit.`
            : `File too large: ${sizeMB}MB exceeds the ${maxSizeMB}MB limit.`,
        },
        { status: 413 }
      );
    }

    // check file type
    const { fileExtension, allowed } = isAllowedExtension(filename);
    if (!allowed) {
      console.error("File type not allowed", { fileExtension });
      return NextResponse.json(
        {
          error: `File type not allowed. Accepted types: ${ALLOWED_EXTENSIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    let textContent: string;
    try {
      textContent = await parseFileFromBuffer(fileBuffer, fileExtension);
    } catch (error) {
      console.error("Failed to parse file", error);
      return NextResponse.json(
        { error: "Failed to parse file" },
        { status: 400 }
      );
    }

    const pineconeClient = getPinecone();
    const index = await pineconeClient.index();

    const matches = await pineconeClient.queryByFilename(filename);
    if (matches.length > 0) {
      console.error("File already exists", { filename });
      return NextResponse.json(
        { error: `File "${filename}" already exists.` },
        { status: 409 }
      );
    }

    let downloadUrl: string;
    let blobUrl: string;
    try {
      const blob = await put(filename, fileBuffer, {
        access: "private",
        contentType: file.type,
      });
      blobUrl = blob.url;
      downloadUrl = getDownloadUrl(blobUrl);
    } catch (error) {
      console.error("Failed to upload to Vercel Blob", error);
      return NextResponse.json(
        { error: "Failed to upload file to storage." },
        { status: 500 }
      );
    }

    const chunks = splitTextIntoChunks(textContent, 1000, 200);
    try {
      const embeddingsArray = await generateEmbeddings(
        chunks.map((c) => c.text)
      );

      const fileUUID = randomUUID();

      const vectors = chunks.map((chunk, idx) => ({
        id: `${fileUUID}_chunk_${idx}`,
        values: embeddingsArray[idx],
        metadata: {
          text: chunk.text,
          filename,
          chunkIndex: idx,
          type: "document_chunk",
          fileUUID,
        },
      }));

      const metadataVector = new Array(1024).fill(0);
      metadataVector[0] = 0.0001;

      await index.upsert({
        records: [
          ...vectors,
          {
            id: `file_metadata_${fileUUID}`,
            values: metadataVector,
            metadata: {
              type: "file_metadata",
              filename,
              fileUUID,
              downloadUrl,
              uploadDate: new Date().toISOString(),
              fileSize: textContent.length,
              chunkCount: chunks.length,
              description: description || "",
            },
          },
        ],
      });
    } catch (error) {
      console.error("Failed to upsert to Pinecone, rolling back blob", error);
      await del(blobUrl).catch((e) =>
        console.error("Failed to rollback blob", e)
      );
      return NextResponse.json(
        { error: "Failed to store file embeddings." },
        { status: 500 }
      );
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
