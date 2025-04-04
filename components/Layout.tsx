import React from "react";
import Head from "next/head";
import styles from "../styles/Layout.module.css";

interface LayoutProps {
  children: React.ReactNode;
  onSaveChat: () => void;
  onSaveChatAsText: () => void;
  onRestartChat: () => void;
  hasMessages: boolean;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  onSaveChat,
  onSaveChatAsText,
  onRestartChat,
  hasMessages,
}) => {
  return (
    <div className={styles.container}>
      <Head>
        <title>AI PI</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <img src="/images/logo.png" alt="AI PI Logo" className={styles.logo} />
          <h1 className={styles.customFont}>AI PI</h1>
        </div>
        <div className={styles.actionButtons}>
          <button onClick={onSaveChat} className={styles.actionButton} disabled={!hasMessages}>
            Save Chat (JSON)
          </button>
          <button
            onClick={onSaveChatAsText}
            className={styles.actionButton}
            disabled={!hasMessages}
          >
            Save Chat (Text)
          </button>
          <button
            onClick={onRestartChat}
            className={`${styles.actionButton} ${styles.clearButton}`}
            disabled={!hasMessages}
          >
            Restart
          </button>
        </div>
      </header>

      {children}

      <div className={styles.disclaimerContainer}>
        <p className={styles.disclaimer}>
          This is an AI-powered assistant. While we strive for accuracy, responses may not always be
          correct. Please verify important information from reliable sources.
        </p>
      </div>
    </div>
  );
};

export default Layout;
