"use server";

import { getErrorMessage } from "@/lib/error";
import { ActionPromise } from "@/lib/promise";
import { revalidatePath } from "next/cache";
import { getPineconeIndex } from "@/lib/pinecone";

export async function deleteFile(filename: string): ActionPromise<void> {
  try {
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

    await index.deleteMany({ ids: idsToDelete });

    revalidatePath("/admin/documents");
    return { isError: false };
  } catch (error) {
    console.error(error);
    return { isError: true, message: getErrorMessage(error) };
  }
}
