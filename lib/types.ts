export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  contexts?: Context[];
  feedback?: string;
  isNotification?: boolean;
  isStreaming?: boolean;
  usedRAG?: boolean; // Whether RAG was used for this response
  traceId?: string;
}

export interface Context {
  id: string;
  score: number;
  values: any[];
  metadata: {
    chunk_idx: number;
    filename: string;
    text: string;
    source?: string;
    type: string;
  };
}
