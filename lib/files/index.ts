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
