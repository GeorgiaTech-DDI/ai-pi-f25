import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("h-4 w-4 pointer-events-none animate-spin", className)}
    />
  );
}
