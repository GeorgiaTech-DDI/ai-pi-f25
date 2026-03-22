import { Message } from "@/lib/types";
import { useScrollToLatestUserMsg } from "../../hooks/useScrollToLatestUserMsg";
import { UserMessageItem } from "./user-message-item";
import { AIMessageItem } from "./ai-message-item";
import { LoadingDots } from "@/components/loaders/loading-dots";
import { QueryStatusType } from "@/app/(public)/page";

export default function Conversation({
  messages,
  userQueryStatus,
  onViewReferencesPressed,
}: {
  messages: Message[];
  userQueryStatus: QueryStatusType;
  onViewReferencesPressed: (msgIdx: number) => void;
}) {
  const { spacerRef } = useScrollToLatestUserMsg(messages);

  let info: string | undefined;
  if (userQueryStatus.status === "web_search_loading") {
    info = userQueryStatus.info;
  }
  const isLoading = userQueryStatus.status === "submitted";
  const isWebSearchLoading = userQueryStatus.status === "web_search_loading";

  return (
    <div className="flex-1 flex flex-col px-4 max-w-3xl mx-auto w-full pt-1">
      {messages.map((message, index) => (
        <div
          key={index}
          data-role={message.role}
          className="snap-start scroll-mt-[24px] pb-12"
        >
          {message.role === "user" ? (
            <UserMessageItem message={message.content} />
          ) : (
            <AIMessageItem
              message={message.content}
              hasReferences={message.usedRAG ?? false}
              onViewReferencesPressed={() => onViewReferencesPressed(index)}
              traceId={message.traceId}
            />
          )}
        </div>
      ))}
      {isLoading && <LoadingDots />}
      {isWebSearchLoading && (
        <p className="text-sm text-muted-foreground italic">
          {info ?? "Searching the web..."}
        </p>
      )}
      <div
        ref={spacerRef}
        className="w-full pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
