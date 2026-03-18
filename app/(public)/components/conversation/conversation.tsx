import { Message } from "@/lib/types";
import { useScrollToLatestUserMsg } from "../../hooks/useScrollToLatestUserMsg";
import { UserMessageItem } from "./user-message-item";
import { AIMessageItem } from "./ai-message-item";
import { LoadingDots } from "@/components/loaders/loading-dots";

export default function Conversation({
  messages,
  isLoading,
}: {
  messages: Message[];
  isLoading: boolean;
}) {
  const { spacerRef } = useScrollToLatestUserMsg(messages);

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
            <AIMessageItem message={message.content} />
          )}
        </div>
      ))}
      {isLoading && <LoadingDots />}
      <div
        ref={spacerRef}
        className="w-full pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
