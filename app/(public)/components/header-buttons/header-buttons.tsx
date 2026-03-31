"use client";
import { Button } from "@/components/ui/button";
import { EllipsisVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function HeaderButtons({ className }: { className?: string }) {
  return (
    <div className={className}>
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
      <Button href="/login" size="lg" variant="outline">
        Admin Log In
      </Button>
    </div>
  );
}
