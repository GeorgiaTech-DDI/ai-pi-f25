"use client";

import { useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { ChatStatus, DefaultChatTransport } from "ai";
import posthog from "posthog-js";
import Chatbox from "./components/chatbox/chatbox";
import { cn } from "@/lib/utils";
import { Context } from "@/lib/types";
import Conversation from "./components/conversation/conversation";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import TermsOfServiceDialog from "./components/tos/tos-dialog";
import ReferencesSheet from "./components/references/references-sheet";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";

const SUGGESTED_ACTIONS = [
  "What's the Invention Studio?",
  "How do I use the bandsaw?",
  "Are there 3D printers?",
];

export type QueryStatusType =
  | {
      status: Exclude<ChatStatus, "error">;
      info?: never;
    }
  | {
      status: "web_search_loading" | "web_search_complete" | "error";
      info: string;
    };

export default function Home() {
  const [queryStatus, setQueryStatusType] = useState<QueryStatusType>({
    status: "ready",
  });

  // Per-message metadata (contexts, usedRAG) keyed by message index
  const [messageMetadata, setMessageMetadata] = useState<
    Record<
      number,
      { contexts?: Context[]; usedRAG?: boolean; traceId?: string }
    >
  >({});

  const {
    messages: sdkMessages,
    status,
    sendMessage,
    stop,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chutes",
      headers: {
        "x-posthog-distinct-id": posthog.get_distinct_id?.() || "anonymous",
      },
    }),
    onFinish: ({ message }) => {
      posthog.capture("chat_response_received", {
        response_length: message.parts
          .filter((p: any) => p.type === "text") // TODO: fix any typing
          .map((p: any) => p.text) // TODO: fix any typing
          .join("").length,
      });
    },
    onError: (err) => {
      setQueryStatusType({ status: "error", info: err.message });
      posthog.capture("chat_error_occurred", { error_message: String(err) });
      posthog.captureException(err);
    },
    onData: (dataPart: any) => {
      const { type, data } = dataPart;
      if (type === "data-web_search_loading") {
        setQueryStatusType({
          status: "web_search_loading",
          info: data.message,
        });
      } else if (type === "data-web_search_complete") {
        setQueryStatusType({
          status: "web_search_complete",
          info: data.message,
        });
      } else if (type === "data-contexts") {
        const assistantIdx = sdkMessages.filter(
          (m) => m.role === "user" || m.role === "assistant"
        ).length;

        setMessageMetadata((prev) => ({
          ...prev,
          [assistantIdx]: {
            ...prev[assistantIdx],
            contexts: data.contexts,
            usedRAG: data.usedRAG,
            traceId: data.traceId,
          },
        }));
      }
    },
  });

  const [prevStatus, setPrevStatus] = useState(status);
  if (prevStatus !== status) {
    setPrevStatus(status);
    if (status !== "error") {
      setQueryStatusType({ status });
    }
  }

  // ── Derive display messages from SDK messages + local metadata ─────────────
  const isLoading =
    queryStatus?.status === "submitted" || queryStatus?.status === "streaming";
  const messages = sdkMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m, i) => ({
      role: m.role as "user" | "assistant",
      content: m.parts
        .filter((p: any) => p.type === "text") // TODO: fix any typing
        .map((p: any) => p.text) // TODO: fix any typing
        .join(""),
      contexts: messageMetadata[i]?.contexts,
      usedRAG: messageMetadata[i]?.usedRAG,
      traceId: messageMetadata[i]?.traceId,
    }));
  const hasMessages = messages.length > 0;

  const [isTOSAccepted, setIsTOSAccepted] = useLocalStorage<boolean>(
    "tos-accepted",
    false
  );

  const [isReferencesSheetOpen, setIsReferencesSheetOpen] = useState(false);
  const [activeReferenceIndex, setActiveReferenceIndex] = useState<
    number | null
  >(null);

  const { isSessionExpired, setIsSessionExpired, idleTimer } =
    useSessionTimeout({
      onSessionExpire: () => {
        if (hasMessages) {
          stop();
          setMessages([]);
          setMessageMetadata({});
          setQueryStatusType({ status: "ready" });
        }

        setIsTOSAccepted(false);
        posthog.capture("chat_logged_out_due_to_timeout");
        posthog.reset();
      },
    });

  const handleSubmit = (message: string): boolean | void => {
    if (isSessionExpired && !hasMessages) {
      setIsSessionExpired(false);
      setIsTOSAccepted(false);
      return false;
    }

    setQueryStatusType({ status: "submitted" });
    posthog.capture("chat_message_submitted", {
      message_length: message.length,
      conversation_turn: messages.filter((m) => m.role === "user").length + 1,
    });
    sendMessage({ text: message });
  };

  return (
    <>
      <TermsOfServiceDialog
        open={!isTOSAccepted}
        onAccept={() => {
          setIsTOSAccepted(true);
          idleTimer.reset();
        }}
      />

      {activeReferenceIndex !== null && (
        <ReferencesSheet
          isOpen={isReferencesSheetOpen}
          onClose={() => setIsReferencesSheetOpen(false)}
          contexts={messageMetadata[activeReferenceIndex]?.contexts ?? []}
        />
      )}

      <div className="min-h-full w-full">
        <div
          className={cn(
            "mx-auto flex size-full max-w-3xl flex-col md:px-2",
            !hasMessages && "pt-[20vh]"
          )}
        >
          <div className="flex-1">
            {hasMessages ? (
              <Conversation
                messages={messages}
                userQueryStatus={queryStatus}
                onViewReferencesPressed={(msgIdx) => {
                  setActiveReferenceIndex(msgIdx);
                  setIsReferencesSheetOpen(true);
                }}
              />
            ) : (
              <div
                className={cn(
                  "flex items-center justify-center",
                  hasMessages && "h-screen"
                )}
              >
                <p className="text-3xl">Hey! How can I help?</p>
              </div>
            )}
          </div>

          <div
            className="bg-background relative sticky bottom-0 z-[5] mx-auto w-full pt-6"
            data-chatbox-container
          >
            <Chatbox
              onSubmit={handleSubmit}
              className="w-full"
              isLoading={isLoading}
              onStopPressed={stop}
            />
            {hasMessages ? (
              <p className="text-muted-foreground py-2 text-center text-xs font-normal">
                AI PI can make mistakes. Always verify technical steps and
                safety protocols with a human PI.
              </p>
            ) : (
              <div className="flex w-full justify-center gap-x-4 py-4">
                {SUGGESTED_ACTIONS.map((action) => (
                  <Button
                    key={action}
                    variant="outline"
                    onClick={() => handleSubmit(action)}
                  >
                    {action}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
