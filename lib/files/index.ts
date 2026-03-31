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
  const response = await fetch(
    `/api/files?filename=${encodeURIComponent(filename)}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    const responseText = await response.text();
    let errorMessage = "Delete failed";
    try {
      errorMessage = JSON.parse(responseText).error || errorMessage;
    } catch {
      errorMessage = responseText || `HTTP ${response.status}`;
    }
    throw new Error(errorMessage);
  }
}
