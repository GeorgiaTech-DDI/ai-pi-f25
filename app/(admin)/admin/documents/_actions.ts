"use server";

import { getErrorMessage } from "@/lib/error";
import { deletePineconeFile } from "@/lib/files";
import { ActionPromise } from "@/lib/promise";
import { revalidatePath } from "next/cache";

export async function deleteFile(filename: string): ActionPromise<void> {
  try {
    await deletePineconeFile(filename);

    revalidatePath("/admin/documents");
    return { isError: false };
  } catch (error) {
    console.error(error);
    return { isError: true, message: getErrorMessage(error) };
  }
}

