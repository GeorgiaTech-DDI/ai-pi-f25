import React from "react";
import { Message } from "../types";
import styles from "@styles/Chat.module.css";

interface MessageItemProps {
  message: Message;
  index: number;
  onFeedbackClick: (index: number) => void;
  onReferencesClick: (index: number) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  index,
  onFeedbackClick,
  onReferencesClick,
}) => {
  const hasContexts = message.contexts && message.contexts.length > 0;
  const isStreaming = message.isStreaming;

  if (message.isNotification) {
    return (
      <div className={styles.systemNotification}>
        <div className={styles.notificationContent}>{message.content}</div>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className={styles.userMessage}>
        <div className={styles.userBubble}>{message.content}</div>
      </div>
    );
  }

  // Assistant message
  const showDisclaimer = !isStreaming && message.usedRAG === false;

  return (
    <div className={`${styles.messageContainer} ${styles.assistantMessageContainer}`}>
      <div className={`${styles.message} ${styles.assistantMessage}`}>
        <div className={styles.messageContent}>
          {message.content}

          {/* Show typing indicator if message is streaming */}
          {isStreaming && (
            <div className={styles.inlineTypingIndicator}>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
            </div>
          )}

          {/* Show disclaimer when no RAG was used */}
          {showDisclaimer && (
            <div className={styles.disclaimer}>
              ℹ️ This response is based on the model's general knowledge and may not reflect specific Invention Studio policies or procedures.
            </div>
          )}
        </div>

        {!isStreaming && hasContexts && (
          <div className={styles.messageActions}>
            <button
              className={`${styles.feedbackButton} ${styles.referencesButton}`}
              onClick={() => onReferencesClick(index)}
              aria-label="View references"
              title="View references used for this answer"
            >
              <span className={styles.feedbackIcon}>📚</span>
              <span className={styles.feedbackText}>References</span>
            </button>

            <button
              className={styles.feedbackButton}
              onClick={() => onFeedbackClick(index)}
              aria-label="Provide feedback on this response"
            >
              <span className={styles.feedbackIcon}>⭐</span>
              <span className={styles.feedbackText}>Rate</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;
