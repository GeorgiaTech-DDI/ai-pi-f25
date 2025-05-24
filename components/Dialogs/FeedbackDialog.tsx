import React, { useState } from "react";
import { DialogProps } from "../types";
import styles from "../../styles/Dialogs.module.css";

interface FeedbackDialogProps extends DialogProps {
  onSubmit: (text: string) => void;
}

const starRatings = [
  { value: 0, label: "Awful", emoji: "😡" },
  { value: 1, label: "Bad", emoji: "😠" },
  { value: 2, label: "Okay", emoji: "😐" },
  { value: 3, label: "Good", emoji: "😊" },
  { value: 4, label: "Great", emoji: "😄" },
  { value: 5, label: "Excellent", emoji: "🤩" },
];

// Helper function to get the style class based on rating value
const getRatingColorClass = (ratingValue: number | null, cssStyles: any): string => {
  if (ratingValue === null) return "";
  if (ratingValue === 5) {
    return cssStyles.selectedGreenBlue;
  } else if (ratingValue === 4) {
    return cssStyles.selectedGreen;
  } else if (ratingValue === 3) {
    return cssStyles.selectedYellowGreen;
  } else if (ratingValue === 2) {
    return cssStyles.selectedYellow;
  } else if (ratingValue === 1) {
    return cssStyles.selectedRedYellow;
  }
  return cssStyles.selectedRed;
};

const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  isVisible,
  fadeState,
  onClose,
  onSubmit,
}) => {
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

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
            <div className={styles.feedbackRating}>
              {starRatings.map((rating) => (
                <button
                  key={rating.value}
                  className={`${styles.ratingButton} ${selectedRating === rating.value ? getRatingColorClass(selectedRating, styles) : ""}`}
                  onClick={() => {
                    setSelectedRating(rating.value);
                    setFeedbackText(`${rating.emoji} `);
                  }}
                  type="button"
                  title={rating.label}
                >
                  {rating.emoji} {rating.label}
                </button>
              ))}
            </div>

            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="What was helpful or not helpful about this response? (optional)"
              rows={4}
            />
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
