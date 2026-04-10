import { deleteFile } from "@/app/(admin)/admin/documents/_actions";
import { PineconeFile } from "./types";
import { UUID } from "crypto";

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
  const oldFileUUID = formData.get("oldFileUUID");
  if (!oldFileUUID) throw new Error("File UUID is required");

  try {
    await deleteFile(oldFileUUID as UUID);

    const response = await fetch("/api/files/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Upload failed");

    return await response.json();
  } catch (error) {
    console.error("Replacement failed:", error);
    throw error;
  }
}
