import { del } from "@vercel/blob";
import { getPineconeIndex } from "../pinecone";
import { PineconeFile } from "./types";

export async function getPineconeFiles(): Promise<PineconeFile[]> {
  const response = await fetch("/api/files", {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = "Failed to load files";
    try {
      errorMessage = JSON.parse(errorText).error || errorMessage;
    } catch {
      errorMessage = errorText || `HTTP ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();

  return data.files as PineconeFile[];
}

export async function deletePineconeFile(filename: string) {
  const index = await getPineconeIndex();
  const dummyVector = new Array(1024).fill(0);
  dummyVector[0] = 0.0001;

  const queryResponse = await index.query({
    vector: dummyVector,
    topK: 1000,
    includeMetadata: true,
    filter: { filename },
  });

  const idsToDelete = queryResponse.matches.map((match) => match.id);
  if (idsToDelete.length === 0)
    return { isError: true, message: "File not found" };

  const results = await Promise.allSettled([
    index.deleteMany({ ids: idsToDelete }),
    del(filename),
  ]);

  if (results[0].status === "rejected") {
    throw results[0].reason;
  }

  if (results[1].status === "rejected") {
    throw results[1].reason;
  }
}

export async function uploadPineconeFile(formData: FormData) {
  const response = await fetch("/api/files/upload", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }
  return response.json();
}

export async function replacePineconeFile(formData: FormData) {
  const oldFilename = formData.get("oldFilename") as string;
  const newFile = formData.get("file") as File | null;

  if (!oldFilename || !newFile) {
    throw new Error(
      "Missing required replacement data: file, oldFilename, or oldBlobUrl."
    );
  }

  try {
    await deletePineconeFile(oldFilename);

    const result = await uploadPineconeFile(formData);

    return {
      success: true,
      message: "Replacement complete",
      data: result,
    };
  } catch (error) {
    console.error("Coordinated replacement failed:", error);
    throw error;
  }
}
