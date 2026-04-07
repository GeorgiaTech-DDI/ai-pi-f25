"use server";

import { getErrorMessage } from "@/lib/error";
import { ActionPromise } from "@/lib/promise";
import { revalidatePath } from "next/cache";
import { authClient } from "@/lib/auth-client";
import { deletePineconeFile } from "@/lib/files";

export async function deleteFile(filename: string): ActionPromise<void> {
  try {
    const session = await authClient.getSession();
    if (!session) {
      throw new Error("Unauthorized");
    }

    await deletePineconeFile(filename);

    revalidatePath("/admin/documents");
    return { isError: false };
  } catch (error) {
    console.error(error);
    return { isError: true, message: getErrorMessage(error) };
  }
}
