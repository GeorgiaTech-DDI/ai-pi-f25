"use server";

import { getErrorMessage } from "@/lib/error";
import { ActionPromise } from "@/lib/promise";
import { revalidatePath } from "next/cache";
import { getPineconeIndex } from "@/lib/pinecone";
import { del } from "@vercel/blob";

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

    revalidatePath("/admin/documents");
    return { isError: false };
  } catch (error) {
    console.error(error);
    return { isError: true, message: getErrorMessage(error) };
  }
}
