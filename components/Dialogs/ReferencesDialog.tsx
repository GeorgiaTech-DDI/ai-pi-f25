import React, { useRef } from "react";
import { DialogProps, Context } from "../types";
import styles from "../../styles/Dialogs.module.css";

interface ReferencesDialogProps extends DialogProps {
  title: string;
  references: Context[];
}

const ReferencesDialog: React.FC<ReferencesDialogProps> = ({
  isVisible,
  fadeState,
  onClose,
  title,
  references,
}) => {
  if (fadeState === "hidden") return null;

  // Group references by filename
  const groupedReferences = references.reduce<Record<string, Context[]>>((acc, context) => {
    const filename = context.metadata?.filename || `Reference ${Object.keys(acc).length + 1}`;
    if (!acc[filename]) {
      acc[filename] = [];
    }
    acc[filename].push(context);
    return acc;
  }, {});

  const handleSummaryClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    const details = e.currentTarget.parentNode as HTMLDetailsElement;

    if (details.hasAttribute("open")) {
      // If it's open, start closing animation
      const content = details.querySelector(`.${styles.contextContent}`) as HTMLElement;
      if (content) {
        content.style.animation = "accordionExit 0.3s ease-out forwards";

        // After animation completes, actually close it
        setTimeout(() => {
          details.removeAttribute("open");
          // Reset animation for next time
          content.style.animation = "";
        }, 280); // Slightly less than animation duration to prevent flicker
      }
    } else {
      // If it's closed, start opening animation
      const content = details.querySelector(`.${styles.contextContent}`) as HTMLElement;
      if (content) {
        content.style.animation = "accordionEnter 0.3s ease-in forwards";
      }
      // After animation completes, actually open it
      setTimeout(() => {
        details.setAttribute("open", "");
      }, 50); // Slightly more than animation duration to ensure it's fully open
    }
  };

  return (
    <div className={`${styles.dialogOverlay} ${styles[fadeState]}`}>
      <div className={`${styles.dialogContent} ${styles.referencesDialog}`}>
        <h2 className={styles.dialogTitle}>{title}</h2>

        <div className={styles.dialogBody}>
          {references.length > 0 ? (
            <>
              {Object.entries(groupedReferences).map(([filename, fileContexts], index) => (
                <details key={index} className={styles.contextAccordion}>
                  <summary onClick={handleSummaryClick}>{filename}</summary>
                  <div className={styles.contextContent}>
                    {fileContexts.map((context, contextIndex) => (
                      <p key={contextIndex}>{context.metadata.text || JSON.stringify(context)}</p>
                    ))}
                  </div>
                </details>
              ))}
            </>
          ) : (
            <p>No references available for this response.</p>
          )}
        </div>

        <div className={styles.dialogActions}>
          <button onClick={onClose} className={styles.primaryButton} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReferencesDialog;
