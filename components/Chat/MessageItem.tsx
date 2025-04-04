import React from "react";
import { Message } from "../types";
import styles from "../../styles/Chat.module.css";

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
  return (
    <div className={styles.assistantMessage}>
      <div className={styles.assistantWrapper}>
        <div className={styles.assistantContent}>{message.content}</div>
        <div className={styles.messageActions}>
          {/* Only show feedback button for assistant messages that don't already have feedback */}
          {!message.feedback && (
            <button
              className={styles.feedbackButton}
              onClick={() => onFeedbackClick(index)}
              aria-label="Provide feedback on this response"
            >
              <span className={styles.feedbackIcon}>⭐</span>
              <span className={styles.feedbackText}>Rate</span>
            </button>
          )}

          {/* References button */}
          {message.contexts && message.contexts.length > 0 && (
            <button
              className={`${styles.feedbackButton} ${styles.referencesButton}`}
              onClick={() => onReferencesClick(index)}
              aria-label="Show reference sources for this response"
            >
              <span className={styles.feedbackIcon}>📚</span>
              <span className={styles.feedbackText}>References</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
