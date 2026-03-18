// import { saveAs } from "file-saver";
// import { Message, ChatHistorySaveData } from "@/lib/types";

// export const saveChatAsJson = (messages: Message[]): void => {
//   if (messages.length === 0) return;

//   const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
//   const filename = `chat-history-${timestamp}.json`;

//   const chatData: ChatHistorySaveData = {
//     messages,
//     savedAt: new Date().toISOString(),
//   };

//   const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: "application/json" });
//   saveAs(blob, filename);
// };

// export const saveChatAsText = (messages: Message[]): void => {
//   if (messages.length === 0) return;

//   const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
//   const filename = `chat-history-${timestamp}.txt`;

//   let textContent = "=== AI PI CHAT HISTORY ===\n\n";
//   let qaPairCount = 0;

//   messages.forEach((msg) => {
//     // Handle different message types
//     if (msg.isNotification) {
//       textContent += `[System: ${msg.content}]\n\n`;
//     } else {
//       const role = msg.role === "user" ? "You" : "AI Assistant";

//       // Increment count for user questions
//       if (msg.role === "user") {
//         qaPairCount++;
//         textContent += `--- Q&A Pair ${qaPairCount} ---\n`;
//       }

//       textContent += `${role}: ${msg.content}\n`;

//       // Include feedback if present
//       if (msg.feedback) {
//         textContent += `[Feedback on this response: ${msg.feedback}]\n`;
//       }

//       // Include references if present
//       if (msg.contexts && msg.contexts.length > 0 && msg.role === "assistant") {
//         textContent += `\n[References:\n`;

//         // Group contexts by filename
//         const groupedContexts = msg.contexts.reduce<Record<string, typeof msg.contexts>>(
//           (acc, context) => {
//             const filename = context.metadata?.filename || "Unknown Source";
//             if (!acc[filename]) acc[filename] = [];
//             acc[filename].push(context);
//             return acc;
//           },
//           {},
//         );

//         Object.entries(groupedContexts).forEach(([filename, fileContexts]) => {
//           textContent += `  - Source: ${filename}\n`;
//           fileContexts.forEach((context, contextIndex) => {
//             textContent += `    - Context ${contextIndex + 1}: ${context.metadata?.text || JSON.stringify(context)}\n`;
//           });
//         });

//         textContent += `]\n`;
//       }

//       textContent += "\n";
//     }
//   });

//   // Add timestamp to the end of the file
//   textContent += "=== END OF CHAT HISTORY ===\n";
//   textContent += `\n[Chat saved at: ${new Date().toLocaleString()}]`;

//   const blob = new Blob([textContent], { type: "text/plain" });
//   saveAs(blob, filename);
// };
