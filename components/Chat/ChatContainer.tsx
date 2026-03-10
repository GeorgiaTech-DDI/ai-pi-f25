import React, { useRef } from "react";
import MessagesList from "./MessagesList";
import InputForm from "./InputForm";
import { Message } from "../types";
import styles from "@/styles/Chat.module.css";

interface ChatContainerProps {
  messages: Message[];
  loading: boolean;
  webSearchLoading: boolean;
  webSearchStatus: string;
  error: string;
  onSubmit: (message: string) => void;
  onFeedbackClick: (index: number) => void;
  onReferencesClick: (index: number) => void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  loading,
  webSearchLoading,
  webSearchStatus,
  error,
  onSubmit,
  onFeedbackClick,
  onReferencesClick,
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.chatContainer} ref={chatContainerRef}>
      <MessagesList
        messages={messages}
        loading={loading}
        webSearchLoading={webSearchLoading}
        webSearchStatus={webSearchStatus}
        onFeedbackClick={onFeedbackClick}
        onReferencesClick={onReferencesClick}
      />

      {error && <p className={styles.error}>Error: {error}</p>}

      <InputForm loading={loading} onSubmit={onSubmit} />
    </div>
  );
};

export default ChatContainer;
