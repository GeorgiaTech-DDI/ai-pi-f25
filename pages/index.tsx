import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import ChatContainer from "../components/Chat/ChatContainer";
import TermsOfServiceDialog from "../components/Dialogs/TermsOfServiceDialog";
import FeedbackDialog from "../components/Dialogs/FeedbackDialog";
import ReferencesDialog from "../components/Dialogs/ReferencesDialog";
import { Message, Context, DialogFadeState } from "../components/types";
import { saveChatAsText } from "../utils/chatUtils";

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
  const [feedbackMessageIndex, setFeedbackMessageIndex] = useState<number | null>(null);
  const [feedbackFadeState, setFeedbackFadeState] = useState<DialogFadeState>("hidden");

  // References dialog state
  const [showReferencesDialog, setShowReferencesDialog] = useState<boolean>(false);
  const [activeReferences, setActiveReferences] = useState<Context[]>([]);
  const [activeReferenceTitle, setActiveReferenceTitle] = useState<string>("");
  const [referencesFadeState, setReferencesFadeState] = useState<DialogFadeState>("hidden");

  // Check localStorage for TOS acceptance on component mount
  useEffect(() => {
    const tosAcceptedStorage = localStorage.getItem('tosAccepted');
    if (tosAcceptedStorage === 'true') {
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

    // Add user message to chat
    const userMessage: Message = { role: "user", content: message };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Add an empty assistant message that will be updated with streaming content
    setMessages([
      ...updatedMessages,
      {
        role: "assistant",
        content: "",
        isStreaming: true,
      },
    ]);

    try {
      // Check if localhost for development mode
      if (window.location.hostname === "localhost") {
        // Development mode mock response with simulated streaming

        // Simulate web search loading
        setWebSearchLoading(true);
        setWebSearchStatus("Searching web for additional context...");

        // Wait 1 second to simulate web search
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Simulate web search completion
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
              text: "This is a test external context from DuckDuckGo search results. It provides additional information that complements the internal knowledge base.",
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
          {
            id: "61",
            score: 0.549824595,
            values: [],
            metadata: {
              chunk_idx: 60,
              filename: "something-else.md",
              text: "[CLS] mark the machine down and contact a waterjet master / apprentice...",
            },
          },
          {
            id: "62",
            score: 0.549824595,
            values: [],
            metadata: {
              chunk_idx: 60,
              filename: "Waterjet-Required&Optional.md",
              text: "[CLS] something else...",
            },
          },
          {
            id: "63",
            score: 0.549824595,
            values: [],
            metadata: {
              chunk_idx: 60,
              filename: "something-else.md",
              text: "[CLS] There are indeed so many things to consider when choosing a waterjet.",
            },
          },
          {
            id: "64",
            score: 0.549824595,
            values: [],
            metadata: {
              chunk_idx: 60,
              filename: "Waterjet-Required&Optional.md",
              text: "[CLS] There are indeed so many things to consider when choosing a waterjet.",
            },
          },
        ];

        // First update with contexts (simulate RAG being used)
        setMessages((currentMessages) => {
          const newMessages = [...currentMessages];
          newMessages[newMessages.length - 1] = {
            ...newMessages[newMessages.length - 1],
            contexts: mockContexts,
            usedRAG: true, // Mock shows RAG being used
          };
          return newMessages;
        });

        // Simulate streaming updates
        for (let i = 0; i < mockChunks.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          mockAnswer += mockChunks[i];

          setMessages((currentMessages) => {
            const newMessages = [...currentMessages];
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: mockAnswer,
            };
            return newMessages;
          });
        }

        // Mark streaming as complete
        setMessages((currentMessages) => {
          const newMessages = [...currentMessages];
          newMessages[newMessages.length - 1] = {
            ...newMessages[newMessages.length - 1],
            isStreaming: false,
          };
          return newMessages;
        });

        setContexts([]);
        setLoading(false);
      } else {
        // Production API call - Switch to use Chutes API instead of RAG API
        const response = await fetch("/api/chutes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: message,
            history: updatedMessages.slice(0, -1).map((msg) => ({
              role: msg.role,
              content: msg.content,
              feedback: msg.feedback,
              isNotification: msg.isNotification,
              // Explicitly exclude only contexts
            })),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        // Process the stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";

        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // Process the stream data
              const text = decoder.decode(value, { stream: true });
              const lines = text.split("\n\n");

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const eventData = JSON.parse(line.slice(5));

                    // Handle different event types
                    if (eventData.type === "web_search_loading") {
                      // Show web search loading indicator
                      setWebSearchLoading(true);
                      setWebSearchStatus(eventData.message || "Searching web...");
                    } else if (eventData.type === "web_search_complete") {
                      // Hide web search loading indicator
                      setWebSearchLoading(false);
                      if (eventData.found) {
                        setWebSearchStatus(`Found context from ${eventData.source}`);
                      } else {
                        setWebSearchStatus("No additional context found");
                      }
                      // Clear status after 2 seconds
                      setTimeout(() => setWebSearchStatus(""), 2000);
                    } else if (eventData.type === "contexts") {
                      // Update the message with contexts and usedRAG flag
                      console.log("Received contexts:", eventData.contexts);
                      console.log("Used RAG:", eventData.usedRAG);
                      if (eventData.usedRAG) {
                        console.log(
                          "DuckDuckGo contexts found:",
                          eventData.contexts.filter((ctx: any) => ctx.id?.startsWith("ddg-")),
                        );
                      }
                      setMessages((currentMessages) => {
                        const newMessages = [...currentMessages];
                        newMessages[newMessages.length - 1] = {
                          ...newMessages[newMessages.length - 1],
                          contexts: eventData.contexts,
                          usedRAG: eventData.usedRAG,
                        };
                        return newMessages;
                      });
                    } else if (eventData.type === "token") {
                      // Append new token to accumulated content
                      accumulatedContent += eventData.content;

                      // Update the message with new content
                      setMessages((currentMessages) => {
                        const newMessages = [...currentMessages];
                        newMessages[newMessages.length - 1] = {
                          ...newMessages[newMessages.length - 1],
                          content: accumulatedContent,
                        };
                        return newMessages;
                      });
                    } else if (eventData.type === "error") {
                      throw new Error(eventData.error);
                    } else if (eventData.type === "done") {
                      // Mark streaming as complete
                      setMessages((currentMessages) => {
                        const newMessages = [...currentMessages];
                        newMessages[newMessages.length - 1] = {
                          ...newMessages[newMessages.length - 1],
                          isStreaming: false,
                        };
                        return newMessages;
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
      // Update the last message to show error
      setMessages((currentMessages) => {
        const newMessages = [...currentMessages];
        if (newMessages[newMessages.length - 1]?.role === "assistant") {
          // Remove the empty streaming message
          newMessages.pop();
        }
        return newMessages;
      });

      setError("Failed to get answer. Please try again.");
      console.error("Frontend error:", e);
      setLoading(false);
    }
  };

  // Function to initiate feedback for a specific message
  const initiateFeedback = (messageIndex: number): void => {
    setFeedbackMessageIndex(messageIndex);
    setShowFeedbackDialog(true);
    // First set entering state
    setFeedbackFadeState("entering");
    // Then after a brief delay, set to visible
    setTimeout(() => setFeedbackFadeState("visible"), 10);
  };

  const closeFeedbackDialog = (): void => {
    // First set exiting state
    setFeedbackFadeState("exiting");
    // Then after animation completes, actually hide the dialog
    setTimeout(() => {
      setShowFeedbackDialog(false);
      setFeedbackFadeState("hidden");
    }, 500);
  };

  // Function to submit feedback
  const submitFeedback = (feedbackText: string): void => {
    if (feedbackMessageIndex === null) return;

    // Create a copy of messages
    const updatedMessages = [...messages];

    // Add feedback to the relevant message
    updatedMessages[feedbackMessageIndex] = {
      ...updatedMessages[feedbackMessageIndex],
      feedback: feedbackText,
    };

    // Add a confirmation message to the chat
    updatedMessages.push({
      role: "system",
      content: "Feedback added to chat history. Press download and then upload your chat history to send feedback. Thank you!",
      isNotification: true,
    });

    setFeedbackFadeState("exiting");
    setTimeout(() => {
      setShowFeedbackDialog(false);
      setMessages(updatedMessages);
    }, 500);
  };

  // Function to show references for a specific message
  const showReferences = (messageIndex: number): void => {
    const message = messages[messageIndex];
    if (message && message.contexts && message.contexts.length > 0) {
      setActiveReferences(message.contexts);
      setActiveReferenceTitle(`References for Q&A #${Math.floor(messageIndex / 2) + 1}`);
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

  // Function to handle TOS acceptance
  const acceptTerms = (): void => {
    // Save acceptance to localStorage
    localStorage.setItem('tosAccepted', 'true');
    
    setTosFadeState("exiting");
    setTimeout(() => {
      setShowTosDialog(false);
      setTosAccepted(true);
      setTosFadeState("hidden");
    }, 500);
  };

  // Function to decline TOS
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
      // Auto-save chat before clearing
      saveChatAsText(messages);
      setHasSaved(true);

      // Clear the chat
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
        onClose={() => {}} // Not used, but required by interface
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

      {/* Main application - only shown after ToS acceptance */}
      {(!showTosDialog || tosAccepted) && (
        <Layout
          onSaveChatAsText={() => {
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
