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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
  const [selectedRating, setSelectedRating] = useState<string | null>(null);

  const handleSubmit = () => {
    onSubmit(feedbackText, selectedRating ? parseInt(selectedRating) : null);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your Feedback</DialogTitle>
          <DialogDescription>
            How was the AI&apos;s response? Your feedback helps us improve.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          <RadioGroup
            value={selectedRating}
            onValueChange={setSelectedRating}
            className="flex flex-wrap justify-center gap-2"
          >
            {RATINGS.map((rating) => {
              const id = `rating-${rating.value}`;
              const isSelected = selectedRating === rating.value.toString();

              return (
                <div key={rating.value} className="flex items-center">
                  <RadioGroupItem
                    value={rating.value.toString()}
                    id={id}
                    className="sr-only"
                  />
                  <Label
                    htmlFor={id}
                    className={cn(
                      "flex flex-col items-center justify-center min-w-[64px] gap-1.5 rounded-md border p-3 transition-all cursor-pointer hover:bg-accent",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-muted bg-transparent opacity-70 hover:opacity-100",
                    )}
                  >
                    <span className="text-2xl">{rating.emoji}</span>
                    <span className="text-[10px] font-bold uppercase tracking-tighter">
                      {rating.label}
                    </span>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          <Textarea
            className="min-h-[120px] resize-none"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="What was helpful or not helpful? (optional)"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
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
