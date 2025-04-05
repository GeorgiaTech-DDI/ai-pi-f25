export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  contexts?: Context[];
  feedback?: string;
  isNotification?: boolean;
  isStreaming?: boolean;
}

export interface Context {
  id: string;
  score: number;
  values: any[];
  metadata: {
    chunk_idx: number;
    filename: string;
    text: string;
  };
}

export interface DialogProps {
  isVisible: boolean;
  fadeState: DialogFadeState;
  onClose: () => void;
}

export type DialogFadeState = "hidden" | "entering" | "visible" | "exiting";

export interface ChatHistorySaveData {
  messages: Message[];
  savedAt: string;
}
