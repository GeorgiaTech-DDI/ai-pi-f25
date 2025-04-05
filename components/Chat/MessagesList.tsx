import React, { useRef, useEffect } from "react";
import MessageItem from "./MessageItem";
import { Message } from "../types";
import styles from "../../styles/Chat.module.css";

interface MessagesListProps {
  messages: Message[];
  loading: boolean;
  onFeedbackClick: (index: number) => void;
  onReferencesClick: (index: number) => void;
}

const MessagesList: React.FC<MessagesListProps> = ({
  messages,
  loading,
  onFeedbackClick,
  onReferencesClick,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className={styles.emptyChat}>
        <p>Ask a question about the Invention Studio to get started</p>
      </div>
    );
  }

  return (
    <div className={styles.messagesArea}>
      {messages.map((message, index) => (
        <MessageItem
          key={index}
          message={message}
          index={index}
          onFeedbackClick={onFeedbackClick}
          onReferencesClick={onReferencesClick}
        />
      ))}

      {loading && !messages.some((msg) => msg.isStreaming) && (
        <div className={styles.assistantMessage}>
          <div className={styles.typingIndicator}>
            <span className={styles.pulse}></span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessagesList;
