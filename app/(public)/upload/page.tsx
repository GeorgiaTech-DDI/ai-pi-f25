"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import posthog from "posthog-js";
import styles from "@/styles/Upload.module.css";

interface FormData {
  overallRating: string;
  experienceDuration: string;
  mostHelpfulFeature: string;
  technicalIssues: string;
  wouldRecommend: string;
  improvementSuggestions: string;
  additionalComments: string;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    overallRating: "",
    experienceDuration: "",
    mostHelpfulFeature: "",
    technicalIssues: "",
    wouldRecommend: "",
    improvementSuggestions: "",
    additionalComments: "",
  });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
      setBlobUrl(null);
      setError(null);
    }
  };

  const handleFormChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = (): boolean => {
    const requiredFields = [
      "overallRating",
      "experienceDuration",
      "wouldRecommend",
    ];
    return requiredFields.every(
      (field) => formData[field as keyof FormData].trim() !== "",
    );
  };

  const generateCombinedContent = async (): Promise<string> => {
    let combinedContent = "=== AI PI FEEDBACK FORM ===\n\n";
    combinedContent += `Overall Rating: ${formData.overallRating}\n`;
    combinedContent += `Experience Duration: ${formData.experienceDuration}\n`;
    combinedContent += `Most Helpful Feature: ${formData.mostHelpfulFeature || "Not specified"}\n`;
    combinedContent += `Technical Issues: ${formData.technicalIssues || "None reported"}\n`;
    combinedContent += `Would Recommend: ${formData.wouldRecommend}\n`;
    combinedContent += `Improvement Suggestions: ${formData.improvementSuggestions || "None provided"}\n`;
    combinedContent += `Additional Comments: ${formData.additionalComments || "None provided"}\n`;
    combinedContent += "\n=== CHAT LOG ===\n\n";
    if (file) combinedContent += await file.text();
    return combinedContent;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) {
      setError("Please fill in all required fields (marked with *).");
      return;
    }
    if (!file) {
      setError("Please select a chat log file to upload.");
      return;
    }

    setUploading(true);
    setError(null);
    setBlobUrl(null);

    try {
      const combinedContent = await generateCombinedContent();
      const combinedBlob = new Blob([combinedContent], { type: "text/plain" });
      const filename = `feedback_and_chatlog_${Date.now()}.txt`;

      const response = await fetch(`/api/upload?filename=${filename}`, {
        method: "POST",
        body: combinedBlob,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Upload failed with status: ${response.status}`,
        );
      }

      const blob = await response.json();
      setBlobUrl(blob.url);
      posthog.capture("feedback_form_submitted", {
        overall_rating: formData.overallRating,
        experience_duration: formData.experienceDuration,
        would_recommend: formData.wouldRecommend,
        has_most_helpful_feature: !!formData.mostHelpfulFeature,
        has_technical_issues: !!formData.technicalIssues,
        has_improvement_suggestions: !!formData.improvementSuggestions,
      });
    } catch (err: any) {
      setError(err.message);
      posthog.captureException(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Submit AI PI Feedback &amp; Chat Log</h1>
      <p className={styles.disclaimerStart}>
        Please complete the feedback form below and upload your anonymized chat
        log file. Each submission should contain feedback and{" "}
        <strong>ONE</strong> chat log.
      </p>
      <p className={styles.disclaimerEnd}>
        Questions with a <strong>*</strong> are required. Thank you for
        contributing to the AI PI research study!
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Experience Feedback</h2>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              How was your experience with the AI PI? *
              <select
                name="overallRating"
                value={formData.overallRating}
                onChange={handleFormChange}
                className={styles.select}
                required
              >
                <option value="">Select Rating...</option>
                <option value="Excellent">Excellent</option>
                <option value="Very Good">Very Good</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </label>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              How long did you interact with the AI PI? *
              <select
                name="experienceDuration"
                value={formData.experienceDuration}
                onChange={handleFormChange}
                className={styles.select}
                required
              >
                <option value="">Select duration...</option>
                <option value="Less than 5 minutes">Less than 5 minutes</option>
                <option value="5-15 minutes">5-15 minutes</option>
                <option value="15-30 minutes">15-30 minutes</option>
                <option value="30-60 minutes">30-60 minutes</option>
                <option value="More than 1 hour">More than 1 hour</option>
              </select>
            </label>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Would you recommend this AI PI to others? *
              <select
                name="wouldRecommend"
                value={formData.wouldRecommend}
                onChange={handleFormChange}
                className={styles.select}
                required
              >
                <option value="">Select...</option>
                <option value="Definitely Yes">Definitely Yes</option>
                <option value="Probably Yes">Probably Yes</option>
                <option value="Maybe">Maybe</option>
                <option value="Probably No">Probably No</option>
                <option value="Definitely No">Definitely No</option>
              </select>
            </label>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              What feature or aspect was most helpful?
              <textarea
                name="mostHelpfulFeature"
                value={formData.mostHelpfulFeature}
                onChange={handleFormChange}
                className={styles.textarea}
                rows={3}
                placeholder="Describe what worked best for you..."
              />
            </label>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Did you encounter any technical issues?
              <textarea
                name="technicalIssues"
                value={formData.technicalIssues}
                onChange={handleFormChange}
                className={styles.textarea}
                rows={3}
                placeholder="Describe any technical problems you experienced..."
              />
            </label>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Do you have any suggestions for improvement?
              <textarea
                name="improvementSuggestions"
                value={formData.improvementSuggestions}
                onChange={handleFormChange}
                className={styles.textarea}
                rows={3}
                placeholder="What would make this AI PI better?"
              />
            </label>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Anything else you&apos;d like to share?
              <textarea
                name="additionalComments"
                value={formData.additionalComments}
                onChange={handleFormChange}
                className={styles.textarea}
                rows={3}
                placeholder="Any other feedback you'd like to share..."
              />
            </label>
          </div>
        </div>

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Chat Log Upload</h2>
          <p className={styles.uploadInstruction}>
            Upload the text chat log file corresponding to the feedback above:
          </p>
          <div className={styles.fileInputContainer}>
            <input
              type="file"
              onChange={handleFileChange}
              disabled={uploading}
              className={styles.fileInput}
              accept=".txt"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={uploading || !file || !validateForm()}
          className={styles.uploadButton}
        >
          {uploading ? (
            <span className={styles.uploadingText}>Uploading...</span>
          ) : (
            "Submit Feedback & Chat Log"
          )}
        </button>
      </form>

      {error && (
        <div className={`${styles.message} ${styles.error}`}>
          Error: {error}
        </div>
      )}

      {blobUrl && (
        <div className={`${styles.message} ${styles.success}`}>
          <p>Feedback and chat log submitted successfully!</p>
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
