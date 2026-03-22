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
}: {
  message: string;
  className?: string;
  hasReferences: boolean;
  onViewReferencesPressed: () => void;
  traceId?: string;
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
              "text-muted-foreground hover:text-foreground h-8 w-8",
              response === "up" &&
                "bg-secondary text-green-500 hover:text-green-500"
            )}
          >
            <ThumbsUp
              className="h-4 w-4"
              fill={response === "up" ? "currentColor" : "none"}
            />
          </Button>
          <Button
            onClick={() => respond("down")}
            variant="ghost"
            size="icon"
            className={cn(
              "text-muted-foreground hover:text-foreground h-8 w-8",
              response === "down" &&
                "bg-secondary text-red-500 hover:text-red-500"
            )}
            ref={triggerRef}
          >
            <ThumbsDown
              className="h-4 w-4"
              fill={response === "down" ? "currentColor" : "none"}
            />
          </Button>
        </div>
        {hasReferences && (
          <Button
            onClick={onViewReferencesPressed}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-8 w-8"
          >
            <FileSearchCorner className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
