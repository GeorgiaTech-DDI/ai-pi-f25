"use client";
import { Button } from "components/ui/Button";
import { Menu } from "components/ui/Menu";
import { EllipsisVertical, MessageSquareCheck } from "lucide-react";
import { useState } from "react";
import FeedbackDialog from "../feedback-dialog/feedback-dialog";

export default function HeaderButtons({ className }: { className?: string }) {
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);

  return (
    <>
      <div className={className}>
        <Button
          variant="icon"
          ghost
          tooltip="Give feedback"
          aria-label="Give feedback"
          onClick={() => setIsFeedbackDialogOpen(true)}
        >
          <MessageSquareCheck />
        </Button>
        <Menu
          trigger={
            <Button variant="icon" ghost aria-label="More options">
              <EllipsisVertical />
            </Button>
          }
        >
          <Menu.Item>Save Chat</Menu.Item>
          <Menu.Item style={{ color: "red" }}>Restart</Menu.Item>
        </Menu>
        <Button href="/admin/login">Admin Log In</Button>
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
