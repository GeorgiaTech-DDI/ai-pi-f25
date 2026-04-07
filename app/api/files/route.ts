import { FileMetadata, PineconeFile } from "@/lib/files/types";
import { getPineconeIndex } from "@/lib/pinecone";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";

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

  const index = await getPineconeIndex();
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
