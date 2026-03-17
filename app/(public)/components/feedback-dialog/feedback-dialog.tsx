"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import styles from "./feedback-dialog.module.css";

const RATINGS = [
  { value: 0, label: "Awful", emoji: "😡" },
  { value: 1, label: "Bad", emoji: "😠" },
  { value: 2, label: "Okay", emoji: "😐" },
  { value: 3, label: "Good", emoji: "😊" },
  { value: 4, label: "Great", emoji: "😄" },
  { value: 5, label: "Excellent", emoji: "🤩" },
];

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (text: string, rating: number | null) => void;
}

export default function FeedbackDialog({
  open,
  onOpenChange,
  onSubmit,
}: FeedbackDialogProps) {
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  const handleSubmit = () => {
    onSubmit(feedbackText, selectedRating);
    setFeedbackText("");
    setSelectedRating(null);
    onOpenChange(false);
  };

  const handleClose = () => {
    setFeedbackText("");
    setSelectedRating(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Your Feedback</DialogTitle>
          <DialogDescription>
            How was the AI&apos;s response? Your feedback helps us improve.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.feedbackBody}>
          <div className={styles.feedbackRating}>
            {RATINGS.map((rating) => (
              <button
                key={rating.value}
                type="button"
                className={styles.ratingButton}
                data-selected={selectedRating === rating.value || undefined}
                onClick={() => {
                  setSelectedRating(rating.value);
                  setFeedbackText(`${rating.emoji} `);
                }}
                aria-pressed={selectedRating === rating.value}
              >
                {rating.emoji} {rating.label}
              </button>
            ))}
          </div>
          <textarea
            className={styles.textarea}
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="What was helpful or not helpful? (optional)"
            rows={4}
          />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={!feedbackText.trim()} onClick={handleSubmit}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
