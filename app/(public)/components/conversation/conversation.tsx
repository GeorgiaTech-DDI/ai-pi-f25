import { Message } from "@/lib/types";
import { UserMessageItem } from "./user-message-item";
import { AIMessageItem } from "./ai-message-item";

export default function Conversation({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col gap-y-8 w-full overflow-y-auto">
      {messages.map((message, index) => (
        <div key={index}>
          {message.role === "user" ? (
            <UserMessageItem message={message.content} />
          ) : (
            <AIMessageItem message={message.content} />
          )}
        </div>
      ))}
    </div>
  );
}
