// import React, { useRef, useEffect, useState } from "react";
// import { DialogProps } from "../types";
// import styles from "../../styles/Dialogs.module.css";

// interface TermsOfServiceDialogProps extends DialogProps {
//   onAccept: () => void;
//   onDecline: () => void;
// }

// const TermsOfServiceDialog: React.FC<TermsOfServiceDialogProps> = ({
//   isVisible,
//   fadeState,
//   onAccept,
//   onDecline,
// }) => {
//   const tosContentRef = useRef<HTMLDivElement>(null);
//   const [canAcceptTos, setCanAcceptTos] = useState(false);

//   // Check if content is scrollable when dialog is visible
//   useEffect(() => {
//     if (isVisible && tosContentRef.current) {
//       const element = tosContentRef.current;
//       const isScrollable = element.scrollHeight > element.clientHeight;
//       if (!isScrollable) {
//         setCanAcceptTos(true); // Not scrollable, allow accept immediately
//       }
//     }
//   }, [isVisible]);

//   // Function to handle scrolling within the ToS content
//   const handleTosScroll = () => {
//     if (canAcceptTos) return;
//     if (!tosContentRef.current) return;

//     const element = tosContentRef.current;
//     const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 5; // Add small tolerance
//     setCanAcceptTos(isAtBottom);
//   };

//   if (fadeState === "hidden") return null;

//   return (
//     <div className={`${styles.dialogOverlay} ${styles[fadeState]}`}>
//       <div className={`${styles.dialogContent} ${styles[fadeState]}`}>
//         <h2 className={styles.dialogTitle}>Terms of Service</h2>

//         <div className={styles.dialogBody} ref={tosContentRef} onScroll={handleTosScroll}>
//           <h3>Understanding AI Limitations</h3>
//           <p>Please be aware that:</p>
//           <ul>
//             <li>AI responses may contain inaccuracies or errors</li>
//             <li>The AI has limited knowledge and may not have information on recent events</li>
//             <li>Always verify critical information from official sources</li>
//           </ul>

//           <h3>Data Collection & Privacy</h3>
//           <p>By using this service, you acknowledge and agree that:</p>
//           <ul>
//             <li>Your chat conversations may be logged and stored</li>
//             <li>Conversation data may be used to improve the system's responses</li>
//             <li>Personal information should not be shared in your queries</li>
//             <li>Your feedback may be collected to enhance service quality</li>
//           </ul>

//           <h4>Appropriate Use</h4>
//           <p>
//             This AI assistant is designed to provide information about the Invention Studio. You
//             agree not to use this system to:
//           </p>
//           <ul>
//             <li>Generate harmful, offensive, or inappropriate content</li>
//             <li>Attempt to extract confidential information</li>
//             <li>Engage in any activity that violates applicable laws or regulations</li>
//           </ul>
//           <h4>Age Requirement</h4>
//           <p>
//             You must be at least 18 years of age or older to use this application. By accepting
//             these terms, you confirm that you meet this age requirement.
//           </p>
//         </div>

//         <div className={`${styles.scrollIndicator} ${canAcceptTos ? styles.hidden : ""}`}>
//           <div className={styles.scrollIcon}>
//             <svg
//               width="24"
//               height="24"
//               viewBox="0 0 24 24"
//               fill="none"
//               xmlns="http://www.w3.org/2000/svg"
//             >
//               <path d="M12 5L12 19" stroke="#999" strokeWidth="2" strokeLinecap="round" />
//               <path
//                 d="M18 13L12 19L6 13"
//                 stroke="#999"
//                 strokeWidth="2"
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//               />
//             </svg>
//           </div>
//           <p>Scroll to continue</p>
//         </div>

//         <div className={styles.dialogActions}>
//           <button onClick={onDecline} className={styles.secondaryButton}>
//             Decline
//           </button>
//           <button onClick={onAccept} className={styles.primaryButton} disabled={!canAcceptTos}>
//             Accept Terms
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default TermsOfServiceDialog;

export default function TermsOfServiceDialog() {
  return <></>;
}
