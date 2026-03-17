"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import posthog from "posthog-js";
// import ChatContainer from "../../components/Chat/ChatContainer";
// import TermsOfServiceDialog from "../../components/Dialogs/TermsOfServiceDialog";
// import ReferencesDialog from "../../components/Dialogs/ReferencesDialog";
import { saveChatAsText } from "../../utils/chatUtils";
import Chatbox from "./components/chatbox/chatbox";
import { cn } from "@/lib/utils";
import { Message, Context } from "@/lib/types";
import Conversation from "./components/conversation/conversation";

export default function Home() {
  const [hasSaved, setHasSaved] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [webSearchLoading, setWebSearchLoading] = useState<boolean>(false);
  const [webSearchStatus, setWebSearchStatus] = useState<string>("");

  // Per-message metadata (contexts, usedRAG) keyed by message index
  const [messageMetadata, setMessageMetadata] = useState<
    Record<
      number,
      { contexts?: Context[]; usedRAG?: boolean; feedback?: string }
    >
  >({});

  // ── useChat ────────────────────────────────────────────────────────────────
  const {
    messages: sdkMessages,
    status,
    sendMessage,
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
      setError("Failed to get answer. Please try again.");
      posthog.capture("chat_error_occurred", { error_message: String(err) });
      posthog.captureException(err);
    },
    onData: (dataPart: any) => {
      const { type, data } = dataPart;
      if (type === "data-web_search_loading") {
        setWebSearchLoading(true);
        setWebSearchStatus(data.message || "Searching web...");
      } else if (type === "data-web_search_complete") {
        setWebSearchLoading(false);
        setWebSearchStatus(
          data.found
            ? `Found context from ${data.source}`
            : "No additional context found",
        );
        setTimeout(() => setWebSearchStatus(""), 2000);
      } else if (type === "data-contexts") {
        const assistantIdx =
          sdkMessages.filter((m) => m.role === "user" || m.role === "assistant")
            .length - 1;
        setMessageMetadata((prev) => ({
          ...prev,
          [assistantIdx]: {
            ...prev[assistantIdx],
            contexts: data.contexts,
            usedRAG: data.usedRAG,
          },
        }));
      }
    },
  });

  // ── Derive display messages from SDK messages + local metadata ─────────────
  const isLoading = status === "submitted" || status === "streaming";
  const messages = sdkMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m, i) => ({
      role: m.role as "user" | "assistant",
      content: m.parts
        .filter((p: any) => p.type === "text") // TODO: fix any typing
        .map((p: any) => p.text) // TODO: fix any typing
        .join(""),
      isStreaming:
        isLoading && i === sdkMessages.length - 1 && m.role === "assistant",
      contexts: messageMetadata[i]?.contexts,
      usedRAG: messageMetadata[i]?.usedRAG,
      feedback: messageMetadata[i]?.feedback,
    }));
  const hasMessages = messages.length > 0;

  // ── Terms of Service ───────────────────────────────────────────────────────
  // const [tosAccepted, setTosAccepted] = useState<boolean>(false);
  // const [showTosDialog, setShowTosDialog] = useState<boolean>(false);
  // const [tosFadeState, setTosFadeState] = useState<
  //   "hidden" | "visible" | "entering" | "exiting"
  // >("hidden");

  // useEffect(() => {
  //   const stored = localStorage.getItem("tosAccepted");
  //   if (stored === "true") {
  //     setTosAccepted(true);
  //   } else {
  //     setShowTosDialog(true);
  //     setTosFadeState("visible");
  //   }
  // }, []);

  // useEffect(() => {
  //   if (showTosDialog) {
  //     setTosFadeState("entering");
  //     setTimeout(() => setTosFadeState("visible"), 10);
  //   } else if (tosFadeState !== "hidden") {
  //     setTosFadeState("exiting");
  //     setTimeout(() => setTosFadeState("hidden"), 500);
  //   }
  // }, [showTosDialog]);

  // // ── Feedback dialog ────────────────────────────────────────────────────────
  // const [showFeedbackDialog, setShowFeedbackDialog] = useState<boolean>(false);
  // const [feedbackMessageIndex, setFeedbackMessageIndex] = useState<
  //   number | null
  // >(null);
  // const [feedbackFadeState, setFeedbackFadeState] = useState<
  //   "hidden" | "visible" | "entering" | "exiting"
  // >("hidden");

  // // ── References dialog ──────────────────────────────────────────────────────
  // const [showReferencesDialog, setShowReferencesDialog] =
  //   useState<boolean>(false);
  // const [activeReferences, setActiveReferences] = useState<Context[]>([]);
  // const [activeReferenceTitle, setActiveReferenceTitle] = useState<string>("");
  // const [referencesFadeState, setReferencesFadeState] = useState<
  //   "hidden" | "visible" | "entering" | "exiting"
  // >("hidden");

  // // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSubmit = (message: string): void => {
    setError("");
    posthog.capture("chat_message_submitted", {
      message_length: message.length,
      conversation_turn: messages.filter((m) => m.role === "user").length + 1,
    });
    sendMessage({ text: message });
  };

  // const initiateFeedback = (messageIndex: number): void => {
  //   setFeedbackMessageIndex(messageIndex);
  //   setShowFeedbackDialog(true);
  //   setFeedbackFadeState("entering");
  //   setTimeout(() => setFeedbackFadeState("visible"), 10);
  // };

  // const closeFeedbackDialog = (): void => {
  //   setFeedbackFadeState("exiting");
  //   setTimeout(() => {
  //     setShowFeedbackDialog(false);
  //     setFeedbackFadeState("hidden");
  //   }, 500);
  // };

  // const submitFeedback = (feedbackText: string): void => {
  //   if (feedbackMessageIndex === null) return;
  //   setMessageMetadata((prev) => ({
  //     ...prev,
  //     [feedbackMessageIndex]: {
  //       ...prev[feedbackMessageIndex],
  //       feedback: feedbackText,
  //     },
  //   }));
  //   posthog.capture("feedback_submitted", {
  //     message_index: feedbackMessageIndex,
  //     feedback_length: feedbackText.length,
  //   });
  //   setFeedbackFadeState("exiting");
  //   setTimeout(() => {
  //     setShowFeedbackDialog(false);
  //     setFeedbackFadeState("hidden");
  //   }, 500);
  // };

  // const showReferences = (messageIndex: number): void => {
  //   const refs = messageMetadata[messageIndex]?.contexts;
  //   if (refs && refs.length > 0) {
  //     setActiveReferences(refs);
  //     setActiveReferenceTitle(
  //       `References for Q&A #${Math.floor(messageIndex / 2) + 1}`,
  //     );
  //     setShowReferencesDialog(true);
  //     setReferencesFadeState("entering");
  //     setTimeout(() => setReferencesFadeState("visible"), 10);
  //   }
  // };

  // const closeReferencesDialog = (): void => {
  //   setReferencesFadeState("exiting");
  //   setTimeout(() => {
  //     setShowReferencesDialog(false);
  //     setReferencesFadeState("hidden");
  //   }, 500);
  // };

  // const acceptTerms = (): void => {
  //   localStorage.setItem("tosAccepted", "true");
  //   posthog.capture("terms_accepted");
  //   setTosFadeState("exiting");
  //   setTimeout(() => {
  //     setShowTosDialog(false);
  //     setTosAccepted(true);
  //     setTosFadeState("hidden");
  //   }, 500);
  // };

  // const declineTerms = (): void => {
  //   alert("You must accept the Terms of Service to use this application.");
  // };

  // const restartChat = (): void => {
  //   if (messages.length === 0) return;
  //   if (
  //     window.confirm(
  //       "Are you sure you want to restart? Your current conversation will be automatically saved.",
  //     )
  //   ) {
  //     posthog.capture("chat_restarted", { message_count: messages.length });
  //     saveChatAsText(messages);
  //     setHasSaved(true);
  //     setMessageMetadata({});
  //     // Note: useChat doesn't expose a reset — reload to clear SDK state
  //     window.location.reload();
  //   }
  // };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* <TermsOfServiceDialog
        isVisible={false}
        fadeState={tosFadeState}
        onAccept={acceptTerms}
        onDecline={declineTerms}
        onClose={() => {}}
      /> */}
      {/* <ReferencesDialog
        isVisible={showReferencesDialog}
        fadeState={referencesFadeState}
        onClose={closeReferencesDialog}
        title={activeReferenceTitle}
        references={activeReferences}
      /> */}

      {/* <ChatContainer
        messages={messages}
        loading={isLoading}
        webSearchLoading={webSearchLoading}
        webSearchStatus={webSearchStatus}
        error={error}
        onSubmit={handleSubmit}
        onFeedbackClick={initiateFeedback}
        onReferencesClick={showReferences}
      /> */}
      <div className="h-full w-full flex justify-center pt-12">
        <div className="w-196 flex flex-col">
          <div className="flex-1 pb-48">
            {hasMessages ? (
              <Conversation messages={messages} />
            ) : (
              <div className="flex items-center justify-center h-screen">
                <p className="text-3xl">Hey! How can I help?</p>
              </div>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 w-fit flex justify-center bg-background">
          <div
            className={cn(
              "w-196 flex flex-col items-center py-4",
              hasMessages ? "gap-y-2" : "gap-y-4",
            )}
          >
            <Chatbox onSubmit={handleSubmit} className="w-full" />
            {hasMessages && (
              <p className="text-xs text-muted-foreground font-normal">
                AI PI can make mistakes. Always verify technical steps and
                safety protocols with a human PI.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
