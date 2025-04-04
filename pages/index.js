import { useState, useRef, useEffect } from "react";
import { saveAs } from "file-saver";
import Head from "next/head";

export default function Home() {
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [contexts, setContexts] = useState([]);
  // New state for Terms of Service
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showTosDialog, setShowTosDialog] = useState(true);
  const [tosFadeState, setTosFadeState] = useState("visible"); // "hidden", "entering", "visible", "exiting"
  // New state for feedback
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackMessageIndex, setFeedbackMessageIndex] = useState(null);
  const [selectedRating, setSelectedRating] = useState(null); // 'thumbsUp', 'thumbsDown', or null
  const [feedbackFadeState, setFeedbackFadeState] = useState("hidden"); // "hidden", "entering", "visible", "exiting"
  // New state for references
  const [showReferencesDialog, setShowReferencesDialog] = useState(false);
  const [activeReferences, setActiveReferences] = useState([]);
  const [activeReferenceTitle, setActiveReferenceTitle] = useState("");
  const [referencesFadeState, setReferencesFadeState] = useState("hidden"); // "hidden", "entering", "visible", "exiting"
  const messagesEndRef = useRef(null);
  // New ref and state for Terms of Service scroll check
  const tosContentRef = useRef(null);
  const [canAcceptTos, setCanAcceptTos] = useState(false);
  const chatContainerRef = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Combined effect to handle ToS dialog animation and scroll check
  useEffect(() => {
    // Handle the fade state animations
    if (showTosDialog) {
      setTosFadeState("entering");
      setTimeout(() => setTosFadeState("visible"), 10);

      // Check if content is scrollable when dialog is visible and ref is available
      if (tosContentRef.current) {
        const element = tosContentRef.current;
        // Check if scrollable initially
        const isScrollable = element.scrollHeight > element.clientHeight;
        if (!isScrollable) {
          setCanAcceptTos(true); // Not scrollable, allow accept immediately
        } // If scrollable, it remains false until scrolled
      }
    } else if (tosFadeState !== "hidden") {
      setTosFadeState("exiting");
      setTimeout(() => setTosFadeState("hidden"), 500); // Match transition duration
      // Reset when dialog is closed
      setCanAcceptTos(false);
    }
  }, [showTosDialog, tosFadeState]); // Re-run when dialog visibility or fade state changes

  // Function to handle scrolling within the ToS content
  const handleTosScroll = () => {
    // If already scrolled to bottom once, no need to check again
    if (canAcceptTos) return;
    if (!tosContentRef.current) return;
    const element = tosContentRef.current;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 5; // Add small tolerance
    setCanAcceptTos(isAtBottom);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!inputMessage.trim()) return;

    setLoading(true);
    setError("");

    // Add user message to chat
    const userMessage = { role: "user", content: inputMessage };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Clear input
    setInputMessage("");

    try {
      // Check if localhost for development mode
      if (window.location.hostname === "localhost") {
        // Development mode mock response
        setTimeout(() => {
          const mockContexts = [
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

          // No need to set global contexts anymore
          setContexts([]);
          setLoading(false);
        }, 1000);
      } else {
        // Production API call
        const response = await fetch("/api/rag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: inputMessage,
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

        // No need to set global contexts anymore
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
  const initiateFeedback = (messageIndex) => {
    setFeedbackMessageIndex(messageIndex);
    setFeedbackText("");
    setSelectedRating(null);
    setShowFeedbackDialog(true);
    setFeedbackFadeState("entering");
    setTimeout(() => setFeedbackFadeState("visible"), 10);
  };

  const closeFeedbackDialog = () => {
    setFeedbackFadeState("exiting");
    setTimeout(() => setShowFeedbackDialog(false), 500);
  };

  // Function to submit feedback
  const submitFeedback = async () => {
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

  // Function to save chat history
  const saveChat = () => {
    if (messages.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `chat-history-${timestamp}.json`;

    const chatData = {
      messages,
      savedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: "application/json" });
    saveAs(blob, filename);
  };

  // Function to save as plain text (more readable)
  const saveChatAsText = () => {
    if (messages.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `chat-history-${timestamp}.txt`;

    let textContent = "=== AI PI CHAT HISTORY ===\n\n";

    let qaPairCount = 0;

    messages.forEach((msg, index) => {
      // Handle different message types
      if (msg.isNotification) {
        textContent += `[System: ${msg.content}]\n\n`;
      } else {
        const role = msg.role === "user" ? "You" : "AI Assistant";

        // Increment count for user questions
        if (msg.role === "user") {
          qaPairCount++;
          textContent += `--- Q&A Pair ${qaPairCount} ---\n`;
        }

        textContent += `${role}: ${msg.content}\n`;

        // Include feedback if present
        if (msg.feedback) {
          textContent += `[Feedback on this response: ${msg.feedback}]\n`;
        }

        // Include references if present
        if (msg.contexts && msg.contexts.length > 0 && msg.role === "assistant") {
          textContent += `\n[References:\n`;

          // Group contexts by filename
          const groupedContexts = msg.contexts.reduce((acc, context) => {
            const filename = context.metadata?.filename || "Unknown Source";
            if (!acc[filename]) acc[filename] = [];
            acc[filename].push(context);
            return acc;
          }, {});

          Object.entries(groupedContexts).forEach(([filename, fileContexts]) => {
            textContent += `  - Source: ${filename}\n`;
            fileContexts.forEach((context, contextIndex) => {
              textContent += `    - Context ${contextIndex + 1}: ${context.metadata?.text || JSON.stringify(context)}\n`;
            });
          });

          textContent += `]\n`;
        }

        textContent += "\n";
      }
    });

    // Add timestamp to the end of the file
    textContent += "=== END OF CHAT HISTORY ===\n";
    textContent += `\n[Chat saved at: ${new Date().toLocaleString()}]`;

    const blob = new Blob([textContent], { type: "text/plain" });
    saveAs(blob, filename);
  };

  const restartChat = () => {
    if (messages.length === 0) return;

    if (
      window.confirm(
        "Are you sure you want to restart? Your current conversation will be automatically saved.",
      )
    ) {
      // Auto-save chat before clearing (using the existing saveChatAsText function)
      saveChatAsText();

      // Clear the chat
      setMessages([]);
      setContexts([]);
      // Reset ToS acceptance and show dialog
      setTosAccepted(false);
      setShowTosDialog(true);
    }
  };

  // Function to handle TOS acceptance
  const acceptTerms = () => {
    setTosFadeState("exiting");
    setTimeout(() => {
      setShowTosDialog(false);
      setTosAccepted(true);
    }, 500);
  };

  // Function to decline TOS
  const declineTerms = () => {
    // You could redirect or show a different message here
    alert("You must accept the Terms of Service to use this application.");
  };

  // Function to show references for a specific message
  const showReferences = (messageIndex) => {
    const message = messages[messageIndex];
    if (message && message.contexts && message.contexts.length > 0) {
      setActiveReferences(message.contexts);
      setActiveReferenceTitle(`References for Q&A #${Math.floor(messageIndex / 2) + 1}`);
      setShowReferencesDialog(true);
      setReferencesFadeState("entering");
      setTimeout(() => setReferencesFadeState("visible"), 10);
    }
  };

  const closeReferencesDialog = () => {
    setReferencesFadeState("exiting");
    setTimeout(() => setShowReferencesDialog(false), 500);
  };

  return (
    <div className="container">
      <Head>
        <title>AI PI</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {/* Terms of Service Dialog */}
      {(showTosDialog || tosFadeState !== "hidden") && (
        <div className={`tos-overlay dialog-overlay dialog-${tosFadeState}`}>
          <div className={`tos-dialog dialog-content dialog-${tosFadeState}`}>
            <h2>Terms of Service</h2>

            <div className="tos-content" ref={tosContentRef} onScroll={handleTosScroll}>
              <h3>Understanding AI Limitations</h3>
              <p>Please be aware that:</p>
              <ul>
                <li>AI responses may contain inaccuracies or errors</li>
                <li>The AI has limited knowledge and may not have information on recent events</li>
                <li>Always verify critical information from official sources</li>
              </ul>

              <h3>Data Collection & Privacy</h3>
              <p>By using this service, you acknowledge and agree that:</p>
              <ul>
                <li>Your chat conversations may be logged and stored</li>
                <li>Conversation data may be used to improve the system's responses</li>
                <li>Personal information should not be shared in your queries</li>
                <li>Your feedback may be collected to enhance service quality</li>
              </ul>

              <h4>Appropriate Use</h4>
              <p>
                This AI assistant is designed to provide information about the Invention Studio. You
                agree not to use this system to:
              </p>
              <ul>
                <li>Generate harmful, offensive, or inappropriate content</li>
                <li>Attempt to extract confidential information</li>
                <li>Engage in any activity that violates applicable laws or regulations</li>
              </ul>
              <h4>Age Requirement</h4>
              <p>
                You must be at least 18 years of age or older to use this application. By accepting
                these terms, you confirm that you meet this age requirement.
              </p>
            </div>

            <div className="tos-actions">
              <button onClick={declineTerms} className="tos-decline-button">
                Decline
              </button>
              <button onClick={acceptTerms} className="tos-accept-button" disabled={!canAcceptTos}>
                Accept Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Dialog */}
      {(showFeedbackDialog || feedbackFadeState !== "hidden") && (
        <div className={`feedback-overlay dialog-overlay dialog-${feedbackFadeState}`}>
          <div className={`feedback-dialog dialog-content dialog-${feedbackFadeState}`}>
            <h2>Share Your Feedback</h2>
            <p>How was the AI's response? Your feedback helps us improve.</p>

            <div className="feedback-content">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="What was helpful or not helpful about this response? (optional)"
                rows={4}
              />

              <div className="feedback-rating">
                <button
                  className={`feedback-rating-btn thumbs-up ${selectedRating === "thumbsUp" ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedRating("thumbsUp");
                    setFeedbackText("👍 ");
                  }}
                >
                  👍 Helpful
                </button>
                <button
                  className={`feedback-rating-btn thumbs-down ${selectedRating === "thumbsDown" ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedRating("thumbsDown");
                    setFeedbackText("👎 ");
                  }}
                >
                  👎 Not Helpful
                </button>
              </div>
            </div>

            <div className="feedback-actions">
              <button onClick={closeFeedbackDialog} className="feedback-cancel-button">
                Cancel
              </button>
              <button
                onClick={submitFeedback}
                className="feedback-submit-button"
                disabled={!feedbackText.trim()}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* References Dialog */}
      {(showReferencesDialog || referencesFadeState !== "hidden") && (
        <div className={`feedback-overlay dialog-overlay dialog-${referencesFadeState}`}>
          <div
            className={`feedback-dialog references-dialog dialog-content dialog-${referencesFadeState}`}
          >
            <h2>{activeReferenceTitle}</h2>

            <div className="tos-content">
              {activeReferences.length > 0 ? (
                <>
                  {Object.entries(
                    activeReferences.reduce((acc, context) => {
                      const filename =
                        context.metadata?.filename || `Reference ${Object.keys(acc).length + 1}`;
                      if (!acc[filename]) {
                        acc[filename] = [];
                      }
                      acc[filename].push(context);
                      return acc;
                    }, {}),
                  ).map(([filename, fileContexts], index) => (
                    <details key={index} className="context-accordion">
                      <summary
                        onClick={(e) => {
                          e.preventDefault();
                          const details = e.currentTarget.parentNode;

                          if (details.hasAttribute("open")) {
                            // If it's open, start closing animation
                            const content = details.querySelector(".context-content");
                            content.style.animation = "accordionExit 0.3s ease-out forwards";

                            // After animation completes, actually close it
                            setTimeout(() => {
                              details.removeAttribute("open");
                              // Reset animation for next time
                              content.style.animation = "";
                            }, 280); // Slightly less than animation duration to prevent flicker
                          } else {
                            // If it's closed, just open it (animation is in CSS)
                            details.setAttribute("open", "");
                          }
                        }}
                      >
                        {filename}
                      </summary>
                      <div className="context-content">
                        {fileContexts.map((context, contextIndex) => (
                          <p key={contextIndex}>
                            {context.metadata.text || JSON.stringify(context)}
                          </p>
                        ))}
                      </div>
                    </details>
                  ))}
                </>
              ) : (
                <p>No references available for this response.</p>
              )}
            </div>

            <div className="tos-actions">
              <button onClick={closeReferencesDialog} className="tos-accept-button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main application - only shown after ToS acceptance */}
      {(!showTosDialog || tosAccepted) && (
        <>
          <header className="header">
            <div className="logo-container">
              <img src="/images/logo.png" alt="AI PI Logo" className="logo" />
              <h1 className="custom-font">AI PI</h1>
            </div>
            <div className="action-buttons">
              <button onClick={saveChat} className="action-button" disabled={messages.length === 0}>
                Save Chat (JSON)
              </button>
              <button
                onClick={saveChatAsText}
                className="action-button"
                disabled={messages.length === 0}
              >
                Save Chat (Text)
              </button>
              <button
                onClick={restartChat}
                className="action-button clear-button"
                disabled={messages.length === 0}
              >
                Restart
              </button>
            </div>
          </header>

          <div className="chat-container" ref={chatContainerRef}>
            <div className="messages-area">
              {messages.length === 0 ? (
                <div className="empty-chat">
                  <p>Ask a question about the Invention Studio to get started</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={
                      message.isNotification
                        ? "system-notification"
                        : message.role === "user"
                          ? "user-message"
                          : "assistant-message"
                    }
                  >
                    {message.isNotification ? (
                      <div className="notification-content">{message.content}</div>
                    ) : message.role === "user" ? (
                      <div className="user-bubble">{message.content}</div>
                    ) : (
                      <div className="assistant-wrapper">
                        <div className="assistant-content">{message.content}</div>
                        <div className="message-actions">
                          {/* Only show feedback button for assistant messages that don't already have feedback */}
                          {!message.feedback && (
                            <button
                              className="feedback-button"
                              onClick={() => initiateFeedback(index)}
                              aria-label="Provide feedback on this response"
                            >
                              <span className="feedback-icon">⭐</span>
                              <span className="feedback-text">Rate</span>
                            </button>
                          )}

                          {/* References button */}
                          {message.contexts && message.contexts.length > 0 && (
                            <button
                              className="feedback-button references-button"
                              onClick={() => showReferences(index)}
                              aria-label="Show reference sources for this response"
                            >
                              <span className="feedback-icon">📚</span>
                              <span className="feedback-text">References</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              {loading && (
                <div className="assistant-message">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {error && <p className="error">Error: {error}</p>}

            <form onSubmit={handleSubmit} className="input-form">
              <input
                type="text"
                placeholder="Ask your question"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={loading}
                required
              />
              <button type="submit" disabled={loading} className="send-button">
                {loading ? (
                  <div className="typing-indicator-send">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                ) : (
                  "Send"
                )}
              </button>
            </form>
          </div>

          <div className="disclaimer-container">
            <p className="disclaimer">
              This is an AI-powered assistant. While we strive for accuracy, responses may not
              always be correct. Please verify important information from reliable sources.
            </p>
          </div>
        </>
      )}

      <style jsx>{`
        * {
          background: #16161f;
          color: #f0f0f9;
        }

        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0px;
          font-family:
            Helvetica Neue,
            Arial,
            sans-serif;
          width: 100%;
          margin: 0;
          height: 100vh;
          overflow: hidden;
          background: #16161f;
        }

        .custom-font {
          font-family: "Inter", monospace;
          font-size: 40px;
          font-weight: bold;
        }

        .logo-container {
          display: flex;
          justify-content: center;
          gap: 12px;
        }

        .logo {
          height: 100px;
          width: auto;
        }

        @media (max-width: 450px) {
          .logo {
            height: 30px;
          }
        }

        .header {
          width: 100%;
          text-align: center;
          margin: 40px 0 20px 0;
        }

        .disclaimer-container {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .disclaimer {
          font-size: 0.9rem;
          color: #666666;
          background-color: #16161f;
          padding: 10px;
          border-radius: 4px;
          margin: 0;
          text-align: center;
          max-width: 600px;
        }

        .chat-container {
          display: flex;
          flex-direction: column;
          width: 85%;
          height: 75vh;
          border: 3px solid #26262f;
          border-radius: 16px;
          background-color: #16161f;
          margin: 0 auto 20px auto;
          overflow: hidden;
        }

        .messages-area {
          flex-grow: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
        }

        .empty-chat {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
          margin: auto;
        }

        .empty-chat p {
          color: #8b8b94;
        }

        .user-message {
          margin-bottom: 16px;
          width: 100%;
          animation: fadeIn 0.3s ease-in-out;
          text-align: right; /* Add this to right-align content */
        }

        .assistant-message {
          margin-bottom: 16px;
          width: 100%;
          animation: fadeIn 0.3s ease-in-out;
        }

        .system-notification {
          margin: 0;
          width: 100%;
          display: flex;
          justify-content: center;
          animation: fadeIn 0.3s ease-in-out;
        }

        .notification-content {
          background-color: #16161f;
          color: #f0f0f9;
          border-radius: 16px;
          padding: 6px 12px;
          font-size: 0.85rem;
          opacity: 0.8;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .user-bubble {
          background-color: rgb(118, 120, 255);
          color: #f0f0f9;
          padding: 12px 16px;
          border-radius: 12px;
          max-width: 85%;
          margin-left: auto;
          word-wrap: break-word;
          display: inline-block;
        }

        .assistant-wrapper {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .assistant-content {
          color: #f0f0f9;
          padding: 12px 0;
          width: 100%;
          line-height: 1.5;
        }

        .feedback-button {
          background: none;
          border: none;
          padding: 6px 10px;
          font-size: 0.8rem;
          color: #e0e0e9;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          margin-top: 4px;
          border-radius: 12px;
          transition: background-color 0.2s;
        }

        .feedback-button:hover {
          background-color: #26262f;
          color: #f0f0f9;
        }

        .feedback-icon {
          margin-right: 4px;
          font-size: 1rem;
          background-color: transparent;
        }

        .feedback-text {
          font-weight: 500;
          background-color: transparent;
        }

        .feedback-indicator {
          font-size: 0.8rem;
          color: #10b981;
          margin-top: 4px;
          padding: 4px 0;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .typing-indicator {
          display: flex;
          padding: 6px 12px;
        }
        .typing-indicator-send {
          display: flex;
        }

        .typing-indicator span {
          height: 8px;
          width: 8px;
          background: #666666;
          display: block;
          border-radius: 50%;
          margin: 0 2px;
          animation: typing 1s infinite ease-in-out;
        }

        .typing-indicator-send span {
          height: 8px;
          width: 8px;
          background: #f0f0f9;
          display: block;
          border-radius: 50%;
          margin: 0 2px;
          animation: typing 1s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(1) {
          animation-delay: 0.2s;
        }
        .typing-indicator span:nth-child(2) {
          animation-delay: 0.4s;
        }
        .typing-indicator span:nth-child(3) {
          animation-delay: 0.6s;
        }

        .typing-indicator-send span:nth-child(1) {
          animation-delay: 0.2s;
        }
        .typing-indicator-send span:nth-child(2) {
          animation-delay: 0.4s;
        }
        .typing-indicator-send span:nth-child(3) {
          animation-delay: 0.6s;
        }

        @keyframes typing {
          0% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
          100% {
            transform: translateY(0px);
          }
        }

        .input-form {
          display: flex;
          padding: 12px;
          border-top: 1px solid #26262f;
          background-color: #16161f;
        }

        input[type="text"] {
          padding: 12px 16px;
          margin-right: 10px;
          border: 1px solid #26262f;
          border-radius: 6px;
          flex-grow: 1;
          font-size: 1rem;
        }

        @media (max-width: 450px) {
          .input-form {
            flex-direction: column;
          }

          input[type="text"] {
            margin-right: 0;
            margin-bottom: 10px;
          }

          .send-button {
            width: 100%;
          }
        }

        button {
          padding: 12px 24px;
          border: none;
          border-radius: 18px;
          background-color: rgb(118, 120, 255);
          color: white;
          cursor: pointer;
          transition: background-color 0.3s;
          font-size: 1rem;
          font-weight: 500;
        }

        .send-button {
          border-radius: 6px;
        }

        button:hover {
          background-color: rgb(95, 98, 240);
        }

        button:disabled {
          background-color: transparent;
          color: transparent;
          border: 1px solid transparent;
          pointer-events: none;
        }

        button:disabled:hover {
          background-color: transparent;
          color: transparent;
          border: 1px solid transparent;
          pointer-events: none;
        }

        .action-buttons {
          display: flex;
          justify-content: center;
          margin-bottom: 0px;
          gap: 10px;
          flex-wrap: wrap;
        }

        .action-button {
          padding: 8px 16px;
          font-size: 0.85rem;
          background-color: #16161f;
          color: #e0e0e9;
          border: 1px solid #999999;
          border-radius: 18px;
        }

        .action-button:hover {
          background-color: #26262f;
        }

        .clear-button {
          color: rgb(252, 211, 211);
          border-color: #993333;
        }

        .clear-button:hover {
          background-color: rgb(84, 7, 7);
        }

        .error {
          color: red;
          padding: 10px 16px;
          margin: 0;
        }

        .context-accordion {
          margin-bottom: 10px;
          border: 1px solid rgb(45, 45, 66);
          border-radius: 6px;
          overflow: hidden;
        }

        .context-accordion summary {
          padding: 10px;
          background-color: #26262f;
          cursor: pointer;
          font-weight: bold;
          position: relative;
          transition: background-color 0.2s ease;
          list-style: none;
        }

        .context-accordion summary:hover {
          background-color: #303045;
        }

        .context-accordion summary::-webkit-details-marker {
          display: none;
        }

        .context-accordion summary::after {
          content: "+";
          position: absolute;
          right: 15px;
          transition: transform 0.3s ease;
        }

        .context-accordion[open] summary::after {
          transform: rotate(45deg);
        }

        .context-content p {
          background-color: #26262f;
        }

        .context-content {
          padding: 10px;
          background-color: #26262f;
          max-height: 300px;
          overflow-y: auto;
          will-change: max-height, opacity;
        }

        /* Animation for opening */
        .context-accordion[open] .context-content {
          animation: accordionEnter 0.3s ease-out forwards;
        }

        @keyframes accordionEnter {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 300px;
          }
        }

        @keyframes accordionExit {
          from {
            opacity: 1;
            max-height: 300px;
          }
          to {
            opacity: 0;
            max-height: 0;
          }
        }

        .dialog-overlay {
          transition: opacity 0.5s ease;
        }

        .dialog-content {
          transition:
            transform 0.5s ease,
            opacity 0.5s ease;
        }

        .dialog-hidden {
          opacity: 0;
          pointer-events: none;
        }

        .dialog-entering {
          opacity: 0;
        }

        .dialog-entering.dialog-content {
          transform: translateY(20px);
        }

        .dialog-visible {
          opacity: 1;
        }

        .dialog-visible.dialog-content {
          transform: translateY(0);
        }

        .dialog-exiting {
          opacity: 0;
          pointer-events: none;
        }

        .dialog-exiting.dialog-content {
          transform: translateY(20px);
        }

        /* Terms of Service Dialog Styles */
        .tos-overlay,
        .feedback-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 20px;
        }

        .tos-dialog,
        .feedback-dialog {
          background-color: #16161f;
          border-radius: 6px;
          max-width: 600px;
          width: 100%;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
        }

        .tos-dialog h2,
        .feedback-dialog h2 {
          padding: 16px 24px;
          margin: 0;
          background-color: #16161f;
          border-bottom: 1px solid #26262f;
        }

        .tos-content,
        .feedback-content {
          padding: 20px 24px;
          overflow-y: auto;
          flex-grow: 1;
        }

        .feedback-dialog p {
          padding: 0 24px;
          margin-top: 10px;
          color: #e0e0e9;
        }

        .tos-content h3 {
          margin-top: 0;
        }

        .tos-content h4 {
          margin-bottom: 8px;
          margin-top: 20px;
        }

        .tos-content p {
          margin-bottom: 12px;
          line-height: 1.5;
        }

        .tos-content ul {
          margin-bottom: 16px;
          padding-left: 20px;
        }

        .tos-content li {
          margin-bottom: 6px;
        }

        .tos-actions,
        .feedback-actions {
          display: flex;
          justify-content: flex-end;
          padding: 16px 24px;
          border-top: 1px solid #26262f;
          gap: 12px;
        }

        .tos-accept-button,
        .feedback-submit-button {
          background-color: rgb(118, 120, 255);
          border-radius: 6px;
        }

        .tos-accept-button:disabled {
          background-color: #555560; /* Darker grey for disabled state */
          color: #9999a0;
          cursor: not-allowed;
        }

        .tos-decline-button,
        .feedback-cancel-button {
          background-color: transparent;
          color: #f0f0f9;
          border-radius: 6px;
          border: 1px solid #ccc;
        }

        .tos-decline-button:hover,
        .feedback-cancel-button:hover {
          background-color: #26262f;
        }

        /* New feedback form styles */
        textarea {
          width: calc(100% - 28px);
          border: 1px solid #333333;
          border-radius: 6px;
          padding: 12px;
          margin: 0 0 16px 0;
          font-size: 1rem;
          font-family: inherit;
          resize: vertical;
        }

        .feedback-rating {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .feedback-rating-btn {
          flex: 1;
          padding: 10px;
          border-radius: 6px;
          border: 1px solid #333333;
          background-color: #16161f;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .feedback-rating-btn.selected {
          border-color: rgb(118, 120, 255);
          background-color: #e6f0ff;
        }

        .thumbs-up.selected {
          border-color: #059669;
          background-color: rgb(9, 52, 9);
        }

        .thumbs-down.selected {
          border-color: #dc2626;
          background-color: rgb(52, 9, 9);
        }

        .thumbs-up:hover:not(.selected) {
          background-color: rgb(12, 72, 12);
        }

        .thumbs-down:hover:not(.selected) {
          background-color: rgb(72, 12, 12);
        }

        .message-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .references-button:hover {
          background-color: #28285f;
        }

        .references-dialog {
          width: 90%;
          max-width: 800px;
        }

        /* Custom scrollbar styling for dark theme */
        .messages-area::-webkit-scrollbar,
        .contexts-container::-webkit-scrollbar,
        .context-content::-webkit-scrollbar,
        .tos-content::-webkit-scrollbar,
        .feedback-content::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .messages-area::-webkit-scrollbar-track,
        .contexts-container::-webkit-scrollbar-track,
        .context-content::-webkit-scrollbar-track,
        .tos-content::-webkit-scrollbar-track,
        .feedback-content::-webkit-scrollbar-track {
          background: #16161f;
          border-radius: 4px;
        }

        .messages-area::-webkit-scrollbar-thumb,
        .contexts-container::-webkit-scrollbar-thumb,
        .context-content::-webkit-scrollbar-thumb,
        .tos-content::-webkit-scrollbar-thumb,
        .feedback-content::-webkit-scrollbar-thumb {
          background: #333340;
          border-radius: 4px;
        }

        .messages-area::-webkit-scrollbar-thumb:hover,
        .contexts-container::-webkit-scrollbar-thumb:hover,
        .context-content::-webkit-scrollbar-thumb:hover,
        .tos-content::-webkit-scrollbar-thumb:hover,
        .feedback-content::-webkit-scrollbar-thumb:hover {
          background: #444452;
        }

        /* Firefox scrollbar styling */
        * {
          scrollbar-width: thin;
          scrollbar-color: #333340 #16161f;
        }
      `}</style>
    </div>
  );
}
