interface FileMetadata {
  filename: string;
  uploadDate: string;
  fileSize: number;
  chunkCount: number;
  description?: string;
}

export interface PineconeFile {
  id: string;
  metadata: FileMetadata;
}