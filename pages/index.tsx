import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import ChatContainer from "../components/Chat/ChatContainer";
import TermsOfServiceDialog from "../components/Dialogs/TermsOfServiceDialog";
import FeedbackDialog from "../components/Dialogs/FeedbackDialog";
import ReferencesDialog from "../components/Dialogs/ReferencesDialog";
import { Message, Context, DialogFadeState } from "../components/types";
import { saveChatAsJson, saveChatAsText } from "../utils/chatUtils";

export default function Home() {
  const [inputMessage, setInputMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);

  // Terms of Service state
  const [tosAccepted, setTosAccepted] = useState<boolean>(false);
  const [showTosDialog, setShowTosDialog] = useState<boolean>(true);
  const [tosFadeState, setTosFadeState] = useState<DialogFadeState>("visible");

  // Feedback dialog state
  const [showFeedbackDialog, setShowFeedbackDialog] = useState<boolean>(false);
  const [feedbackMessageIndex, setFeedbackMessageIndex] = useState<number | null>(null);
  const [feedbackFadeState, setFeedbackFadeState] = useState<DialogFadeState>("hidden");

  // References dialog state
  const [showReferencesDialog, setShowReferencesDialog] = useState<boolean>(false);
  const [activeReferences, setActiveReferences] = useState<Context[]>([]);
  const [activeReferenceTitle, setActiveReferenceTitle] = useState<string>("");
  const [referencesFadeState, setReferencesFadeState] = useState<DialogFadeState>("hidden");

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
    setError("");

    // Add user message to chat
    const userMessage: Message = { role: "user", content: message };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    try {
      // Check if localhost for development mode
      if (window.location.hostname === "localhost") {
        // Development mode mock response
        setTimeout(() => {
          const mockContexts: Context[] = [
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

          setMessages([
            ...updatedMessages,
            {
              role: "assistant",
              content: "This is a test answer",
              contexts: mockContexts,
            },
          ]);

          setContexts([]);
          setLoading(false);
        }, 1000);
      } else {
        // Production API call
        const response = await fetch("/api/rag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: message,
            history: updatedMessages.slice(0, -1), // Send previous messages as history
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Add assistant response to chat with its contexts
        setMessages([
          ...updatedMessages,
          {
            role: "assistant",
            content: data.answer,
            contexts: data.contexts || [],
          },
        ]);

        setContexts([]);
        setLoading(false);
      }
    } catch (e) {
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
      content: "Feedback submitted. Thank you!",
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

      // Clear the chat
      setMessages([]);
      setContexts([]);
      // Reset ToS acceptance and show dialog
      setTosAccepted(false);
      setShowTosDialog(true);
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
          onSaveChat={() => saveChatAsJson(messages)}
          onSaveChatAsText={() => saveChatAsText(messages)}
          onRestartChat={restartChat}
          hasMessages={messages.length > 0}
        >
          <ChatContainer
            messages={messages}
            loading={loading}
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
