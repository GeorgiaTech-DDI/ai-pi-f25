import React from "react";
import Head from "next/head";
import Link from "next/link";
import styles from "../styles/Layout.module.css";

interface LayoutProps {
  children: React.ReactNode;
  onSaveChatAsText: () => void;
  onRestartChat: () => void;
  hasMessages: boolean;
  hasSaved: boolean;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  onSaveChatAsText,
  onRestartChat,
  hasMessages,
  hasSaved,
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
          onClick={onSaveChatAsText}
          className={`${styles.actionButton} ${styles.downloadButtonHeader}`}
          disabled={!hasMessages}
        >
          Download
        </button>
        <button
          onClick={() => {
            // redirect to /upload
            window.location.href = "/upload";
          }}
          className={`${styles.actionButton} ${styles.uploadButtonHeader}`}
          disabled={!hasSaved}
        >
          Upload
        </button>
        <button
          onClick={onRestartChat}
          className={`${styles.actionButton} ${styles.clearButton} ${styles.restartButtonHeader}`}
          disabled={!hasMessages}
        >
          Restart
        </button>
        <Link href="/admin/login" className={`${styles.actionButton} ${styles.adminButtonHeader}`}>
          Admin
        </Link>
      </header>

      <div className={styles.disclaimerContainer}>
        <p className={styles.disclaimer}>
          This chatbot is designed to provide assistance for the Georgia Tech Invention Studio or General Makerspaces. It's capabilites are limited in other use cases.
        </p>
      </div>

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
