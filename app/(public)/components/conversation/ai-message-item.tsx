import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileSearchCorner } from "lucide-react";

export function AIMessageItem({
  message,
  className,
  hasReferences,
  onViewReferencesPressed,
}: {
  message: string;
  className?: string;
  hasReferences: boolean;
  onViewReferencesPressed: () => void;
}) {
  return (
    <div className={cn("flex flex-col gap-y-2", className)}>
      <p>{message}</p>
      {hasReferences && (
        <Button
          onClick={onViewReferencesPressed}
          variant="ghost"
          size="icon"
        >
          <FileSearchCorner className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
