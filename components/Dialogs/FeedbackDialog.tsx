import React, { useState } from "react";
import { DialogProps } from "../types";
import styles from "../../styles/Dialogs.module.css";

interface FeedbackDialogProps extends DialogProps {
  onSubmit: (text: string) => void;
}

const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  isVisible,
  fadeState,
  onClose,
  onSubmit,
}) => {
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedRating, setSelectedRating] = useState<"thumbsUp" | "thumbsDown" | null>(null);

  const handleSubmit = () => {
    onSubmit(feedbackText);
    setFeedbackText("");
    setSelectedRating(null);
  };

  if (fadeState === "hidden") return null;

  return (
    <div className={`${styles.dialogOverlay} ${styles[fadeState]}`}>
      <div className={`${styles.dialogContent} ${styles[fadeState]}`}>
        <h2 className={styles.dialogTitle}>Share Your Feedback</h2>
        <div className={styles.dialogBody}>
          <p>How was the AI's response? Your feedback helps us improve.</p>

          <div className={styles.feedbackContent}>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="What was helpful or not helpful about this response? (optional)"
              rows={4}
            />

            <div className={styles.feedbackRating}>
              <button
                className={`${styles.ratingButton} ${styles.thumbsUp} ${selectedRating === "thumbsUp" ? styles.selected : ""}`}
                onClick={() => {
                  setSelectedRating("thumbsUp");
                  setFeedbackText("👍 ");
                }}
                type="button"
              >
                👍 Helpful
              </button>
              <button
                className={`${styles.ratingButton} ${styles.thumbsDown} ${selectedRating === "thumbsDown" ? styles.selected : ""}`}
                onClick={() => {
                  setSelectedRating("thumbsDown");
                  setFeedbackText("👎 ");
                }}
                type="button"
              >
                👎 Not Helpful
              </button>
            </div>
          </div>
        </div>

        <div className={styles.dialogActions}>
          <button onClick={onClose} className={styles.secondaryButton} type="button">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={styles.primaryButton}
            disabled={!feedbackText.trim()}
            type="button"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackDialog;
