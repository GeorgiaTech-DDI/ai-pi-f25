"use client";

import { useState, useEffect } from "react";
import posthog from "posthog-js";
import Layout from "../../components/Layout";
import ChatContainer from "../../components/Chat/ChatContainer";
import TermsOfServiceDialog from "../../components/Dialogs/TermsOfServiceDialog";
import FeedbackDialog from "../../components/Dialogs/FeedbackDialog";
import ReferencesDialog from "../../components/Dialogs/ReferencesDialog";
import { Message, Context, DialogFadeState } from "../../components/types";
import { saveChatAsText } from "../../utils/chatUtils";

export default function Home() {
  const [loading, setLoading] = useState<boolean>(false);
  const [webSearchLoading, setWebSearchLoading] = useState<boolean>(false);
  const [webSearchStatus, setWebSearchStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [_, setContexts] = useState<Context[]>([]);
  const [hasSaved, setHasSaved] = useState<boolean>(false);

  // Terms of Service state
  const [tosAccepted, setTosAccepted] = useState<boolean>(false);
  const [showTosDialog, setShowTosDialog] = useState<boolean>(false);
  const [tosFadeState, setTosFadeState] = useState<DialogFadeState>("hidden");

  // Feedback dialog state
  const [showFeedbackDialog, setShowFeedbackDialog] = useState<boolean>(false);
  const [feedbackMessageIndex, setFeedbackMessageIndex] = useState<
    number | null
  >(null);
  const [feedbackFadeState, setFeedbackFadeState] =
    useState<DialogFadeState>("hidden");

  // References dialog state
  const [showReferencesDialog, setShowReferencesDialog] =
    useState<boolean>(false);
  const [activeReferences, setActiveReferences] = useState<Context[]>([]);
  const [activeReferenceTitle, setActiveReferenceTitle] = useState<string>("");
  const [referencesFadeState, setReferencesFadeState] =
    useState<DialogFadeState>("hidden");

  // Check localStorage for TOS acceptance on component mount
  useEffect(() => {
    const tosAcceptedStorage = localStorage.getItem("tosAccepted");
    if (tosAcceptedStorage === "true") {
      setTosAccepted(true);
      setShowTosDialog(false);
      setTosFadeState("hidden");
    } else {
      setTosAccepted(false);
      setShowTosDialog(true);
      setTosFadeState("visible");
    }
  }, []);

  // Handle ToS dialog animation
  useEffect(() => {
    if (showTosDialog) {
      setTosFadeState("entering");
      setTimeout(() => setTosFadeState("visible"), 10);
    } else if (tosFadeState !== "hidden") {
      setTosFadeState("exiting");
      setTimeout(() => setTosFadeState("hidden"), 500);
    }
  }, [showTosDialog, tosFadeState]);

  const handleSubmit = async (message: string): Promise<void> => {
    setLoading(true);
    setWebSearchLoading(false);
    setWebSearchStatus("");
    setError("");

    posthog.capture("chat_message_submitted", {
      message_length: message.length,
      conversation_turn: messages.filter((m) => m.role === "user").length + 1,
    });

    const userMessage: Message = { role: "user", content: message };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    setMessages([
      ...updatedMessages,
      { role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      if (false) {
        // Development mode mock response with simulated streaming
        setWebSearchLoading(true);
        setWebSearchStatus("Searching web for additional context...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setWebSearchLoading(false);
        setWebSearchStatus("Found context from DuckDuckGo");
        setTimeout(() => setWebSearchStatus(""), 2000);

        let mockAnswer = "";
        const mockChunks = [
          "This ",
          "is ",
          "a ",
          "test ",
          "answer ",
          "with ",
          "simulated ",
          "streaming ",
          "for ",
          "development ",
          "purposes.",
        ];

        const mockContexts: Context[] = [
          {
            id: "ddg-test",
            score: 1.0,
            values: [],
            metadata: {
              chunk_idx: -1,
              filename: "🌐 DuckDuckGo",
              text: "This is a test external context from DuckDuckGo search results.",
              source: "DuckDuckGo",
            },
          },
          {
            id: "60",
            score: 0.549824595,
            values: [],
            metadata: {
              chunk_idx: 60,
              filename: "Waterjet-Required&Optional.md",
              text: "[CLS] mark the machine down and contact a waterjet master / apprentice...",
            },
          },
        ];

        setMessages((cur) => {
          const m = [...cur];
          m[m.length - 1] = {
            ...m[m.length - 1],
            contexts: mockContexts,
            usedRAG: true,
          };
          return m;
        });

        for (const chunk of mockChunks) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          mockAnswer += chunk;
          setMessages((cur) => {
            const m = [...cur];
            m[m.length - 1] = { ...m[m.length - 1], content: mockAnswer };
            return m;
          });
        }

        setMessages((cur) => {
          const m = [...cur];
          m[m.length - 1] = { ...m[m.length - 1], isStreaming: false };
          return m;
        });
        setContexts([]);
        setLoading(false);
      } else {
        // Production API call
        const response = await fetch("/api/chutes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-posthog-distinct-id": posthog.get_distinct_id() || "anonymous",
          },
          body: JSON.stringify({
            question: message,
            history: updatedMessages.slice(0, -1).map((msg) => ({
              role: msg.role,
              content: msg.content,
              feedback: msg.feedback,
              isNotification: msg.isNotification,
            })),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`,
          );
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";

        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const text = decoder.decode(value, { stream: true });
              const lines = text.split("\n\n");

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const eventData = JSON.parse(line.slice(5));
                    if (eventData.type === "web_search_loading") {
                      setWebSearchLoading(true);
                      setWebSearchStatus(
                        eventData.message || "Searching web...",
                      );
                    } else if (eventData.type === "web_search_complete") {
                      setWebSearchLoading(false);
                      setWebSearchStatus(
                        eventData.found
                          ? `Found context from ${eventData.source}`
                          : "No additional context found",
                      );
                      setTimeout(() => setWebSearchStatus(""), 2000);
                    } else if (eventData.type === "contexts") {
                      setMessages((cur) => {
                        const m = [...cur];
                        m[m.length - 1] = {
                          ...m[m.length - 1],
                          contexts: eventData.contexts,
                          usedRAG: eventData.usedRAG,
                        };
                        return m;
                      });
                    } else if (eventData.type === "token") {
                      accumulatedContent += eventData.content;
                      setMessages((cur) => {
                        const m = [...cur];
                        m[m.length - 1] = {
                          ...m[m.length - 1],
                          content: accumulatedContent,
                        };
                        return m;
                      });
                    } else if (eventData.type === "error") {
                      throw new Error(eventData.error);
                    } else if (eventData.type === "done") {
                      setMessages((cur) => {
                        const m = [...cur];
                        m[m.length - 1] = {
                          ...m[m.length - 1],
                          isStreaming: false,
                        };
                        return m;
                      });
                      posthog.capture("chat_response_received", {
                        response_length: accumulatedContent.length,
                        conversation_turn: updatedMessages.filter(
                          (msg) => msg.role === "user",
                        ).length,
                      });
                    }
                  } catch (e) {
                    console.error("Error parsing stream event:", e, line);
                  }
                }
              }
            }
          } catch (e) {
            console.error("Stream reading error:", e);
            throw e;
          } finally {
            setLoading(false);
          }
        } else {
          throw new Error("Failed to get stream from response");
        }
      }
    } catch (e) {
      setMessages((cur) => {
        const m = [...cur];
        if (m[m.length - 1]?.role === "assistant") m.pop();
        return m;
      });
      setError("Failed to get answer. Please try again.");
      console.error("Frontend error:", e);
      posthog.capture("chat_error_occurred", {
        error_message: e instanceof Error ? e.message : String(e),
      });
      posthog.captureException(e);
      setLoading(false);
    }
  };

  const initiateFeedback = (messageIndex: number): void => {
    setFeedbackMessageIndex(messageIndex);
    setShowFeedbackDialog(true);
    setFeedbackFadeState("entering");
    setTimeout(() => setFeedbackFadeState("visible"), 10);
  };

  const closeFeedbackDialog = (): void => {
    setFeedbackFadeState("exiting");
    setTimeout(() => {
      setShowFeedbackDialog(false);
      setFeedbackFadeState("hidden");
    }, 500);
  };

  const submitFeedback = (feedbackText: string): void => {
    if (feedbackMessageIndex === null) return;
    const updatedMessages = [...messages];
    updatedMessages[feedbackMessageIndex] = {
      ...updatedMessages[feedbackMessageIndex],
      feedback: feedbackText,
    };
    updatedMessages.push({
      role: "system",
      content:
        "Feedback added to chat history. Press download and then upload your chat history to send feedback. Thank you!",
      isNotification: true,
    });
    posthog.capture("feedback_submitted", {
      message_index: feedbackMessageIndex,
      feedback_length: feedbackText.length,
    });
    setFeedbackFadeState("exiting");
    setTimeout(() => {
      setShowFeedbackDialog(false);
      setMessages(updatedMessages);
    }, 500);
  };

  const showReferences = (messageIndex: number): void => {
    const message = messages[messageIndex];
    if (message?.contexts && message.contexts.length > 0) {
      setActiveReferences(message.contexts);
      setActiveReferenceTitle(
        `References for Q&A #${Math.floor(messageIndex / 2) + 1}`,
      );
      setShowReferencesDialog(true);
      setReferencesFadeState("entering");
      setTimeout(() => setReferencesFadeState("visible"), 10);
    }
  };

  const closeReferencesDialog = (): void => {
    setReferencesFadeState("exiting");
    setTimeout(() => {
      setShowReferencesDialog(false);
      setReferencesFadeState("hidden");
    }, 500);
  };

  const acceptTerms = (): void => {
    localStorage.setItem("tosAccepted", "true");
    posthog.capture("terms_accepted");
    setTosFadeState("exiting");
    setTimeout(() => {
      setShowTosDialog(false);
      setTosAccepted(true);
      setTosFadeState("hidden");
    }, 500);
  };

  const declineTerms = (): void => {
    alert("You must accept the Terms of Service to use this application.");
  };

  const restartChat = (): void => {
    if (messages.length === 0) return;
    if (
      window.confirm(
        "Are you sure you want to restart? Your current conversation will be automatically saved.",
      )
    ) {
      posthog.capture("chat_restarted", {
        message_count: messages.length,
      });
      saveChatAsText(messages);
      setHasSaved(true);
      setMessages([]);
      setContexts([]);
    }
  };

  return (
    <>
      <TermsOfServiceDialog
        isVisible={showTosDialog}
        fadeState={tosFadeState}
        onAccept={acceptTerms}
        onDecline={declineTerms}
        onClose={() => {}}
      />
      <FeedbackDialog
        isVisible={showFeedbackDialog}
        fadeState={feedbackFadeState}
        onClose={closeFeedbackDialog}
        onSubmit={submitFeedback}
      />
      <ReferencesDialog
        isVisible={showReferencesDialog}
        fadeState={referencesFadeState}
        onClose={closeReferencesDialog}
        title={activeReferenceTitle}
        references={activeReferences}
      />

      {(!showTosDialog || tosAccepted) && (
        <Layout
          onSaveChatAsText={() => {
            posthog.capture("chat_saved", {
              message_count: messages.length,
            });
            saveChatAsText(messages);
            setHasSaved(true);
          }}
          onRestartChat={restartChat}
          hasMessages={messages.length > 0}
          hasSaved={hasSaved}
        >
          <ChatContainer
            messages={messages}
            loading={loading}
            webSearchLoading={webSearchLoading}
            webSearchStatus={webSearchStatus}
            error={error}
            onSubmit={handleSubmit}
            onFeedbackClick={initiateFeedback}
            onReferencesClick={showReferences}
          />
        </Layout>
      )}
    </>
  );
}
