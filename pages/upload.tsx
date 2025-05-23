"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import styles from "../styles/Upload.module.css";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
      setBlobUrl(null);
      setError(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setUploading(true);
    setError(null);
    setBlobUrl(null);

    try {
      const response = await fetch(`/api/upload?filename=${file.name}`, {
        method: "POST",
        body: file,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed with status: ${response.status}`);
      }

      const blob = await response.json();
      setBlobUrl(blob.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Upload Chat Anonymously</h1>
      <p className={styles.disclaimerStart}>
        Please use this page to securely upload the anonymized chat log file.
      </p>
      <p className={styles.disclaimer}>
        Reminder: Please ensure you are only uploading the .txt log file.
      </p>
      <p className={styles.disclaimerEnd}>
        Thank you for contributing to the AI PI research study!
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fileInputContainer}>
          <input
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            className={styles.fileInput}
          />
        </div>
        <button type="submit" disabled={uploading || !file} className={styles.uploadButton}>
          {uploading ? <span className={styles.uploadingText}>Uploading...</span> : "Upload"}
        </button>
      </form>

      {error && <div className={`${styles.message} ${styles.error}`}>Error: {error}</div>}

      {blobUrl && (
        <div className={`${styles.message} ${styles.success}`}>
          <p>File uploaded successfully!</p>
          <p>
            URL:{" "}
            <a href={blobUrl} target="_blank" rel="noopener noreferrer">
              {blobUrl}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
