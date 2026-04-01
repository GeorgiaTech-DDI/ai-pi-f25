"use server";

import { getErrorMessage } from "@/lib/error";
import { deletePineconeFile } from "@/lib/files";
import { ActionPromise } from "@/lib/promise";
import { revalidatePath } from "next/cache";
import "pdf-parse/worker";
import { PDFParse, VerbosityLevel } from "pdf-parse";

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

export async function uploadFile(formData: FormData): ActionPromise<void> {
  try {
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { isError: true, message: "No file" };

    const description = formData.get("description") as string;
    const arrayBuffer = await file.arrayBuffer();

    let extractedText = "";

    if (file.name.toLowerCase().endsWith(".pdf")) {
      const parser = new PDFParse({
        data: arrayBuffer,
        verbosity: VerbosityLevel.ERRORS,
      });

      try {
        const data = await parser.getText();
        extractedText = data.text;
      } finally {
        await parser.destroy();
      }
    } else if (
      file.name.toLowerCase().endsWith(".txt") ||
      file.name.toLowerCase().endsWith(".md")
    ) {
      extractedText = Buffer.from(arrayBuffer).toString("utf-8");
    } else {
      return { isError: true, message: "Unsupported file type" };
    }

    console.log({
      filename: file.name,
      description,
      content: extractedText.slice(0, 100),
    });

    const response = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        content: extractedText,
        description: description,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    revalidatePath("/admin/documents");
    return { isError: false };
  } catch (error) {
    console.error("Upload error:", error);
    return { isError: true, message: getErrorMessage(error) };
  }
}
