import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileSearchCorner, ThumbsUp, ThumbsDown } from "lucide-react";
import { useThumbSurvey } from "posthog-js/react/surveys";

const LLM_RESPONSE_SURVEY_ID = "019d16a8-a562-0000-f48b-b4997727d842"; // LLM Feedback v2 in Posthog

export function AIMessageItem({
  message,
  className,
  hasReferences,
  onViewReferencesPressed,
  traceId,
  isStreaming,
}: {
  message: string;
  className?: string;
  hasReferences: boolean;
  onViewReferencesPressed: () => void;
  traceId?: string;
  isStreaming?: boolean;
}) {
  const { respond, response, triggerRef } = useThumbSurvey({
    surveyId: LLM_RESPONSE_SURVEY_ID,
    ...(traceId ? { properties: { $trace_id: traceId } } : {}),
  });
  return (
    <div className={cn("group flex flex-col gap-y-2", className)}>
      <p>{message}</p>

      <div className="flex gap-x-2">
        <div
          className={cn(
            "flex gap-x-1 transition-opacity",
            response ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <Button
            onClick={() => respond("up")}
            variant="ghost"
            size="icon"
            className={cn(
              "text-muted-foreground hover:text-foreground",
              response === "up" &&
                "bg-secondary text-green-500 hover:text-green-500"
            )}
          >
            <ThumbsUp fill={response === "up" ? "currentColor" : "none"} />
          </Button>
          <Button
            onClick={() => respond("down")}
            variant="ghost"
            size="icon"
            className={cn(
              "text-muted-foreground hover:text-foreground",
              response === "down" &&
                "bg-secondary text-destructive hover:text-destructive"
            )}
            ref={triggerRef}
          >
            <ThumbsDown fill={response === "down" ? "currentColor" : "none"} />
          </Button>
          {hasReferences && (
            <Button
              onClick={onViewReferencesPressed}
              variant="ghost"
              size="icon"
              className={cn(
                "text-muted-foreground hover:text-foreground",
                isStreaming && "invisible pointer-events-none"
              )}
              aria-hidden={isStreaming}
            >
              <FileSearchCorner />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
