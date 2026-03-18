"use client";
import { Button } from "@/components/ui/button";
import { EllipsisVertical, MessageSquareCheck } from "lucide-react";
import { useState } from "react";
import FeedbackDialog from "../feedback/feedback-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function HeaderButtons({ className }: { className?: string }) {
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);

  return (
    <>
      <div className={className}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Give feedback"
          onClick={() => setIsFeedbackDialogOpen(true)}
        >
          <MessageSquareCheck />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="More options">
                <EllipsisVertical />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Save Chat</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Restart</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button href="/admin/login" size="lg" variant="outline">
          Admin Log In
        </Button>
      </div>

      <FeedbackDialog
        open={isFeedbackDialogOpen}
        onOpenChange={setIsFeedbackDialogOpen}
        onSubmit={(text, rating) => {
          console.log("Feedback submitted:", { text, rating });
          setIsFeedbackDialogOpen(false);
        }}
      />
    </>
  );
}
