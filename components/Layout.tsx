import React from "react";
import Head from "next/head";
import styles from "../styles/Layout.module.css";

interface LayoutProps {
  children: React.ReactNode;
  onSaveChat: () => void; // Keep props even if buttons are commented out
  onSaveChatAsText: () => void; // Keep props even if buttons are commented out
  onRestartChat: () => void;
  hasMessages: boolean;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  onSaveChat, // Keep props
  onSaveChatAsText, // Keep props
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
          <img src="/images/logo.svg" alt="AI PI Logo" className={styles.logo} />
          <h1 className={styles.customFont}>AI PI</h1>
        </div>
        <button
          onClick={onRestartChat}
          className={`${styles.actionButton} ${styles.clearButton} ${styles.restartButtonHeader}`}
          disabled={!hasMessages}
        >
          Restart
        </button>
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
