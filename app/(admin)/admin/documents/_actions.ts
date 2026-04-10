"use server";

import { getErrorMessage } from "@/lib/error";
import { ActionPromise } from "@/lib/promise";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getPineconeIndex } from "@/lib/pinecone";
import { del } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { UUID } from "crypto";

export async function deleteFile(fileUUID: UUID): ActionPromise<void> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) {
      throw new Error("Unauthorized");
    }

    const index = await getPineconeIndex();
    const dummyVector = new Array(1024).fill(0);
    dummyVector[0] = 0.0001;

    const queryResponse = await index.query({
      vector: dummyVector,
      topK: 1000,
      includeMetadata: true,
      filter: { fileUUID: { $eq: fileUUID } },
    });

    const dataToDelete = queryResponse.matches.map((match) => ({
      id: match.id,
      fileName: match.metadata?.filename,
    }));

    if (dataToDelete.length === 0)
      return { isError: true, message: "File not found" };

    const results = await Promise.allSettled([
      index.deleteMany({ ids: dataToDelete.map((data) => data.id) }),
      del(
        dataToDelete
          .filter((data) => data.fileName)
          .map((data) => String(data.fileName))
      ),
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
