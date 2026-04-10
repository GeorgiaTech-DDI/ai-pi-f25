import { UUID } from "crypto";

export interface FileMetadata {
  filename: string;
  uploadDate: string;
  fileSize: number;
  chunkCount: number;
  description?: string;
  downloadUrl?: string;
  fileUUID: UUID;
}

export interface PineconeFile {
  id: string;
  metadata: FileMetadata;
}
