"use client";

import { signOut, useSession } from "@/lib/auth-client";
import styles from "@/styles/Dashboard.module.css";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useState } from "react";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { PineconeFile } from "@/lib/files/types";
import { getPineconeFiles } from "@/lib/files";

interface DocumentationGap {
  question: string;
  frequency: number;
  bestScore: number;
  topDocument: string;
  lastAsked: string;
}

interface DocumentPerformance {
  filename: string;
  queryCount: number;
  averageScore: number;
  highScoreCount: number;
  status: "excellent" | "good" | "needs_improvement";
}

interface QueryLog {
  timestamp: string;
  question: string;
  bestScore: number;
  totalMatches: number;
  relevantMatches: number;
  matchesAbove06: number;
  matchesAbove05: number;
  matchesAbove04: number;
  topDocuments: { filename: string; score: number }[];
  decision: "USE_RAG" | "USE_GENERAL";
  confidenceLevel: "high" | "medium" | "low" | "n/a";
}

interface AnalyticsData {
  summary: {
    totalQueries: number;
    ragSuccessCount: number;
    generalFallbackCount: number;
    ragSuccessRate: number;
    avgBestScore: number;
  };
  documentationGaps: DocumentationGap[];
  documentPerformance: DocumentPerformance[];
  recentLogs: QueryLog[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, isPending: loading } = useSession();
  const user = session?.user
    ? {
        email: session.user.email,
        displayName: session.user.name || session.user.email,
      }
    : null;
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // File management state
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Analytics state
  const [expandedReferences, setExpandedReferences] = useState<number | null>(
    null
  );

  useSessionTimeout({
    onSessionExpire: async () => {
      posthog.capture("admin_logged_out_due_to_timeout", {
        email: user?.email,
      });
      posthog.reset();
      try {
        await signOut({
          fetchOptions: { onSuccess: () => router.replace("/") },
        });
      } catch (error) {
        console.error("Timeout logout error:", error);
        router.replace("/");
      }
    },
  });

  const {
    data: files = [],
    isLoading: isFilesLoading,
    error: filesError,
    refetch: refetchFiles,
  } = useQuery({
    queryKey: ["files"],
    queryFn: getPineconeFiles,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const {
    data: analytics,
    refetch: refetchAnalytics,
    error: analyticsError,
    isLoading: isAnalyticsLoading,
  } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const response = await fetch("/api/analytics");
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to load analytics";
        try {
          errorMessage = JSON.parse(errorText).error || errorMessage;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      return data as AnalyticsData;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const MAX_FILE_SIZE_MB = 4;
      const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
      const isPDF = uploadFile.name.toLowerCase().endsWith(".pdf");
      const estimatedUploadSize = isPDF
        ? uploadFile.size * 1.33
        : uploadFile.size;
      if (estimatedUploadSize > MAX_FILE_SIZE_BYTES) {
        const fileSizeMB = (uploadFile.size / (1024 * 1024)).toFixed(2);
        const encodedSizeMB = (estimatedUploadSize / (1024 * 1024)).toFixed(2);
        throw new Error(
          isPDF
            ? `PDF file too large: ${fileSizeMB}MB original → ${encodedSizeMB}MB encoded. Max is ${MAX_FILE_SIZE_MB}MB encoded.`
            : `File too large: ${fileSizeMB}MB. Max is ${MAX_FILE_SIZE_MB}MB.`
        );
      }
      let content: string;
      if (isPDF) {
        const reader = new FileReader();
        content = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(uploadFile);
        });
      } else {
        content = await uploadFile.text();
      }
      const response = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: uploadFile.name,
          content,
          description: uploadDescription,
        }),
      });
      if (!response.ok) {
        if (response.status === 413)
          throw new Error("File too large for upload. Maximum size is 4MB.");
        const responseText = await response.text();
        let errorMessage = "Upload failed";
        try {
          errorMessage = JSON.parse(responseText).error || errorMessage;
        } catch {
          errorMessage = responseText || `HTTP ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      setSuccess("File uploaded successfully!");
      posthog.capture("admin_file_uploaded", {
        filename: uploadFile.name,
        file_size: uploadFile.size,
        is_pdf: uploadFile.name.toLowerCase().endsWith(".pdf"),
        has_description: !!uploadDescription,
      });
      setUploadFile(null);
      setUploadDescription("");
      const fileInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      await refetchFiles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = async (filename: string) => {
    setDeleting(filename);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/files?filename=${encodeURIComponent(filename)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const responseText = await response.text();
        let errorMessage = "Delete failed";
        try {
          errorMessage = JSON.parse(responseText).error || errorMessage;
        } catch {
          errorMessage = responseText || `HTTP ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      setSuccess("File deleted successfully!");
      posthog.capture("admin_file_deleted", {
        filename,
      });
      setShowDeleteConfirm(null);
      await refetchFiles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString();

  const aggregatePDFScores = (
    topDocuments: { filename: string; score: number }[]
  ) => {
    const pdfScores: { [key: string]: { scores: number[]; count: number } } =
      {};
    topDocuments.forEach((doc) => {
      if (!pdfScores[doc.filename])
        pdfScores[doc.filename] = { scores: [], count: 0 };
      pdfScores[doc.filename].scores.push(doc.score);
      pdfScores[doc.filename].count++;
    });
    return Object.entries(pdfScores)
      .map(([filename, data]) => ({
        filename,
        averageScore:
          data.scores.reduce((sum, score) => sum + score, 0) /
          data.scores.length,
        chunkCount: data.count,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);
  };

  const calculateAverageScore = (
    topDocuments: { filename: string; score: number }[]
  ) => {
    if (!topDocuments || topDocuments.length === 0) return 0;
    return (
      topDocuments.reduce((acc, doc) => acc + doc.score, 0) /
      topDocuments.length
    );
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    posthog.capture("admin_logged_out", { email: user?.email });
    posthog.reset();
    try {
      await signOut({
        fetchOptions: { onSuccess: () => router.replace("/admin/login") },
      });
    } catch (error) {
      console.error("Logout error:", error);
      router.replace("/admin/login");
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <div className={styles.container}>
        {/* Main Content */}
        <main className={styles.main}>
          {/* Documentation Quality Analytics */}
          <section className={styles.fileManagement}>
            <div className={styles.fileListHeader}>
              <h2 className={styles.sectionTitle}>📊 Documentation Quality</h2>
              <button
                onClick={() => refetchAnalytics()}
                disabled={isAnalyticsLoading}
                className={`${styles.button} ${styles.buttonSecondary} ${styles.smallButton}`}
              >
                {isAnalyticsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            {analyticsError && (
              <div className={styles.errorMessage}>
                Error loading analytics: {analyticsError.message}
              </div>
            )}
            {isAnalyticsLoading ? (
              <div className={styles.loadingMessage}>Loading analytics...</div>
            ) : analytics ? (
              <>
                <div
                  className={styles.fileManagementGrid}
                  style={{ marginBottom: "24px" }}
                >
                  <div className={styles.fileManagementSection}>
                    <h3 className={styles.subsectionTitle}>
                      RAG Performance Summary
                    </h3>
                    <div
                      style={{
                        padding: "16px",
                        backgroundColor: "#1e293b",
                        borderRadius: "8px",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, 1fr)",
                          gap: "16px",
                        }}
                      >
                        <div>
                          <p
                            style={{
                              fontSize: "14px",
                              color: "#94a3b8",
                              marginBottom: "4px",
                            }}
                          >
                            Total Queries
                          </p>
                          <p
                            style={{
                              fontSize: "24px",
                              fontWeight: "bold",
                              color: "#f1f5f9",
                            }}
                          >
                            {analytics.summary.totalQueries}
                          </p>
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: "14px",
                              color: "#94a3b8",
                              marginBottom: "4px",
                            }}
                          >
                            RAG Success Rate
                          </p>
                          <p
                            style={{
                              fontSize: "24px",
                              fontWeight: "bold",
                              color:
                                analytics.summary.ragSuccessRate >= 70
                                  ? "#22c55e"
                                  : analytics.summary.ragSuccessRate >= 50
                                    ? "#f59e0b"
                                    : "#ef4444",
                            }}
                          >
                            {analytics.summary.ragSuccessRate.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: "14px",
                              color: "#94a3b8",
                              marginBottom: "4px",
                            }}
                          >
                            RAG Success
                          </p>
                          <p
                            style={{
                              fontSize: "20px",
                              fontWeight: "bold",
                              color: "#22c55e",
                            }}
                          >
                            {analytics.summary.ragSuccessCount} queries
                          </p>
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: "14px",
                              color: "#94a3b8",
                              marginBottom: "4px",
                            }}
                          >
                            General Fallback
                          </p>
                          <p
                            style={{
                              fontSize: "20px",
                              fontWeight: "bold",
                              color: "#f59e0b",
                            }}
                          >
                            {analytics.summary.generalFallbackCount} queries
                          </p>
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: "16px",
                          paddingTop: "16px",
                          borderTop: "1px solid #334155",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#94a3b8",
                            marginBottom: "4px",
                          }}
                        >
                          Average Best Score
                        </p>
                        <p
                          style={{
                            fontSize: "20px",
                            fontWeight: "bold",
                            color: "#60a5fa",
                          }}
                        >
                          {analytics.summary.avgBestScore.toFixed(3)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={styles.fileManagementGrid}>
                  <div className={styles.fileManagementSection}>
                    <h3 className={styles.subsectionTitle}>
                      ⚠️ Documentation Gaps
                    </h3>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#94a3b8",
                        marginBottom: "16px",
                      }}
                    >
                      Questions that failed to find good documentation
                      (confidence &lt; 0.6)
                    </p>
                    {analytics.documentationGaps.length === 0 ? (
                      <div className={styles.emptyMessage}>
                        ✅ No documentation gaps found! All queries are finding
                        good matches.
                      </div>
                    ) : (
                      <div className={styles.fileList}>
                        {analytics.documentationGaps.map((gap, index) => (
                          <div key={index} className={styles.fileItem}>
                            <div className={styles.fileInfo}>
                              <div className={styles.fileName}>
                                {index + 1}. {gap.question}
                              </div>
                              <div className={styles.fileDetails}>
                                <span>Asked {gap.frequency} times</span>
                                <span>
                                  Best score: {gap.bestScore.toFixed(3)}
                                </span>
                                <span>Top doc: {gap.topDocument}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.fileManagementSection}>
                    <h3 className={styles.subsectionTitle}>
                      📄 Document Performance
                    </h3>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#94a3b8",
                        marginBottom: "16px",
                      }}
                    >
                      How well each document matches user queries
                    </p>
                    {analytics.documentPerformance.length === 0 ? (
                      <div className={styles.emptyMessage}>
                        No document performance data available yet.
                      </div>
                    ) : (
                      <div className={styles.fileList}>
                        {analytics.documentPerformance.map((doc, index) => (
                          <div key={index} className={styles.fileItem}>
                            <div className={styles.fileInfo}>
                              <div className={styles.fileName}>
                                {doc.status === "excellent" && "⭐ "}
                                {doc.status === "good" && "✅ "}
                                {doc.status === "needs_improvement" && "⚠️ "}
                                {doc.filename}
                              </div>
                              <div className={styles.fileDetails}>
                                <span>Used in {doc.queryCount} queries</span>
                                <span>
                                  Avg score: {doc.averageScore.toFixed(3)}
                                </span>
                                <span>High scores: {doc.highScoreCount}</span>
                                <span
                                  style={{
                                    color:
                                      doc.status === "excellent"
                                        ? "#22c55e"
                                        : doc.status === "good"
                                          ? "#60a5fa"
                                          : "#f59e0b",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {doc.status === "excellent"
                                    ? "Excellent"
                                    : doc.status === "good"
                                      ? "Good"
                                      : "Needs Improvement"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyMessage}>
                No analytics data available yet.
              </div>
            )}
          </section>

          {/* Recent Query Logs */}
          <section className={styles.fileManagement}>
            <div className={styles.fileListHeader}>
              <h2 className={styles.sectionTitle}>📋 Recent Query Logs</h2>
              <button
                onClick={() => refetchAnalytics()}
                disabled={isAnalyticsLoading}
                className={`${styles.button} ${styles.buttonSecondary} ${styles.smallButton}`}
              >
                {isAnalyticsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <p
              style={{
                fontSize: "14px",
                color: "#94a3b8",
                marginBottom: "16px",
              }}
            >
              All queries from users, updated in real-time (auto-refreshes every
              30 seconds)
            </p>
            {isAnalyticsLoading ? (
              <div className={styles.loadingMessage}>Loading query logs...</div>
            ) : analytics?.recentLogs?.length ? (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    backgroundColor: "#1e293b",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#0f172a" }}>
                      <th
                        style={{
                          padding: "12px",
                          textAlign: "left",
                          color: "#94a3b8",
                          fontSize: "14px",
                          fontWeight: "600",
                        }}
                      >
                        Timestamp
                      </th>
                      <th
                        style={{
                          padding: "12px",
                          textAlign: "left",
                          color: "#94a3b8",
                          fontSize: "14px",
                          fontWeight: "600",
                        }}
                      >
                        Query
                      </th>
                      <th
                        style={{
                          padding: "12px",
                          textAlign: "center",
                          color: "#94a3b8",
                          fontSize: "14px",
                          fontWeight: "600",
                        }}
                      >
                        RAG Used
                      </th>
                      <th
                        style={{
                          padding: "12px",
                          textAlign: "center",
                          color: "#94a3b8",
                          fontSize: "14px",
                          fontWeight: "600",
                        }}
                      >
                        Confidence
                      </th>
                      <th
                        style={{
                          padding: "12px",
                          textAlign: "center",
                          color: "#94a3b8",
                          fontSize: "14px",
                          fontWeight: "600",
                        }}
                      >
                        Avg Score
                      </th>
                      <th
                        style={{
                          padding: "12px",
                          textAlign: "left",
                          color: "#94a3b8",
                          fontSize: "14px",
                          fontWeight: "600",
                        }}
                      >
                        References (Click to Expand)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recentLogs.map((log, index) => (
                      <tr
                        key={index}
                        style={{
                          borderBottom:
                            index < analytics.recentLogs.length - 1
                              ? "1px solid #334155"
                              : "none",
                        }}
                      >
                        <td
                          style={{
                            padding: "12px",
                            color: "#cbd5e1",
                            fontSize: "13px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(log.timestamp).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            color: "#f1f5f9",
                            fontSize: "14px",
                            maxWidth: "300px",
                          }}
                        >
                          {log.question}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "4px 8px",
                              backgroundColor:
                                log.decision === "USE_RAG"
                                  ? "#22c55e20"
                                  : "#f59e0b20",
                              color:
                                log.decision === "USE_RAG"
                                  ? "#22c55e"
                                  : "#f59e0b",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: "600",
                            }}
                          >
                            {log.decision === "USE_RAG" ? "✅ Yes" : "❌ No"}
                          </span>
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "4px 8px",
                              backgroundColor:
                                log.confidenceLevel === "high"
                                  ? "#22c55e20"
                                  : log.confidenceLevel === "medium"
                                    ? "#60a5fa20"
                                    : log.confidenceLevel === "low"
                                      ? "#f59e0b20"
                                      : "#64748b20",
                              color:
                                log.confidenceLevel === "high"
                                  ? "#22c55e"
                                  : log.confidenceLevel === "medium"
                                    ? "#60a5fa"
                                    : log.confidenceLevel === "low"
                                      ? "#f59e0b"
                                      : "#94a3b8",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: "600",
                              textTransform: "uppercase",
                            }}
                          >
                            {log.confidenceLevel === "n/a"
                              ? "N/A"
                              : log.confidenceLevel}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            color: "#cbd5e1",
                            fontSize: "13px",
                            fontWeight: "600",
                          }}
                        >
                          {log.topDocuments?.length
                            ? calculateAverageScore(log.topDocuments).toFixed(3)
                            : "—"}
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            color: "#cbd5e1",
                            fontSize: "12px",
                          }}
                        >
                          {log.topDocuments?.length ? (
                            (() => {
                              const aggregated = aggregatePDFScores(
                                log.topDocuments
                              );
                              const isExpanded = expandedReferences === index;
                              const displayed = isExpanded
                                ? aggregated
                                : aggregated.slice(0, 3);
                              return (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "4px",
                                  }}
                                >
                                  {displayed.map((pdf, pdfIndex) => (
                                    <div
                                      key={pdfIndex}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "4px 8px",
                                        backgroundColor: "#0f172a",
                                        borderRadius: "4px",
                                      }}
                                    >
                                      <span
                                        style={{
                                          color: "#94a3b8",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                          maxWidth: "200px",
                                        }}
                                      >
                                        {pdf.filename}
                                        {pdf.chunkCount > 1 && (
                                          <span
                                            style={{
                                              color: "#64748b",
                                              fontSize: "10px",
                                              marginLeft: "4px",
                                            }}
                                          >
                                            ({pdf.chunkCount} chunks)
                                          </span>
                                        )}
                                      </span>
                                      <span
                                        style={{
                                          color:
                                            pdf.averageScore >= 0.7
                                              ? "#22c55e"
                                              : pdf.averageScore >= 0.5
                                                ? "#60a5fa"
                                                : "#f59e0b",
                                          fontWeight: "600",
                                          marginLeft: "8px",
                                        }}
                                      >
                                        {pdf.averageScore.toFixed(3)}
                                      </span>
                                    </div>
                                  ))}
                                  {aggregated.length > 3 && (
                                    <button
                                      onClick={() =>
                                        setExpandedReferences(
                                          isExpanded ? null : index
                                        )
                                      }
                                      style={{
                                        color: "#60a5fa",
                                        fontSize: "11px",
                                        fontStyle: "italic",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                        padding: "4px",
                                        textAlign: "left",
                                      }}
                                    >
                                      {isExpanded
                                        ? "▼ Show less"
                                        : `▶ Show ${aggregated.length - 3} more PDFs`}
                                    </button>
                                  )}
                                  <div
                                    style={{
                                      color: "#64748b",
                                      fontSize: "10px",
                                      marginTop: "4px",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    {log.topDocuments.length} total chunks from{" "}
                                    {aggregated.length}{" "}
                                    {aggregated.length === 1
                                      ? "document"
                                      : "documents"}
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <span
                              style={{ color: "#64748b", fontStyle: "italic" }}
                            >
                              No references
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.emptyMessage}>
                No query logs available yet.
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Confirm Delete</h3>
            <p className={styles.modalMessage}>
              Are you sure you want to delete &quot;{showDeleteConfirm}&quot;?
              This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className={`${styles.button} ${styles.buttonSecondary}`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleFileDelete(showDeleteConfirm)}
                disabled={deleting === showDeleteConfirm}
                className={`${styles.button} ${styles.buttonDanger}`}
              >
                {deleting === showDeleteConfirm ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
