import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useMsal } from '@azure/msal-react';
import { useAuth } from '../../context/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import styles from '../../styles/Dashboard.module.css';

interface FileMetadata {
  filename: string;
  uploadDate: string;
  fileSize: number;
  chunkCount: number;
  description?: string;
}

interface PineconeFile {
  id: string;
  metadata: FileMetadata;
}

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
  status: 'excellent' | 'good' | 'needs_improvement';
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
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { instance } = useMsal();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // File management state
  const [files, setFiles] = useState<PineconeFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // File management functions
  const loadFiles = async () => {
    // Don't attempt to load if user is not authenticated yet
    if (!user?.email) {
      console.log('⏳ Waiting for user authentication before loading files...');
      return;
    }
    
    setLoadingFiles(true);
    setError(null);
    try {
      const response = await fetch('/api/files', {
        headers: {
          'x-user-email': user?.email || '',
          'x-user-name': user?.displayName || ''
        }
      });
      if (!response.ok) {
        // Read response text first, then try to parse as JSON
        let errorMessage = 'Failed to load files';
        const responseText = await response.text();
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Not JSON, use the text directly
          errorMessage = responseText || `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err: any) {
      console.error('Error loading files:', err);
      setError(err.message);
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadAnalytics = async () => {
    // Don't attempt to load if user is not authenticated yet
    if (!user?.email) {
      console.log('⏳ Waiting for user authentication before loading analytics...');
      return;
    }

    setLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const response = await fetch('/api/analytics', {
        headers: {
          'x-user-email': user?.email || '',
          'x-user-name': user?.displayName || ''
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to load analytics';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setAnalytics(data);
      console.log('✅ Analytics loaded:', data);
    } catch (err: any) {
      console.error('Error loading analytics:', err);
      setAnalyticsError(err.message);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const content = await uploadFile.text();
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.email || '',
          'x-user-name': user?.displayName || ''
        },
        body: JSON.stringify({
          filename: uploadFile.name,
          content,
          description: uploadDescription,
        }),
      });

      if (!response.ok) {
        // Handle 413 Payload Too Large specially
        if (response.status === 413) {
          throw new Error('File too large for upload. Maximum size is 4MB. Please use a smaller file.');
        }
        
        // Read response text first, then try to parse as JSON
        const responseText = await response.text();
        let errorMessage = 'Upload failed';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Not JSON, use the text directly
          errorMessage = responseText || `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      setSuccess('File uploaded successfully!');
      setUploadFile(null);
      setUploadDescription('');
      // Clear the file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      loadFiles(); // Refresh file list
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
      const response = await fetch(`/api/files?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': user?.email || '',
          'x-user-name': user?.displayName || ''
        }
      });

      if (!response.ok) {
        // Read response text first, then try to parse as JSON
        const responseText = await response.text();
        let errorMessage = 'Delete failed';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = responseText || `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      setSuccess('File deleted successfully!');
      setShowDeleteConfirm(null);
      loadFiles(); // Refresh file list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Authentication is now handled by ProtectedRoute component

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      await instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin + '/admin/login'
      });
      console.log('🔐 MSAL logout initiated');
      // Note: Code after logoutRedirect won't execute as page redirects
    } catch (error) {
      console.error('🔐 MSAL logout error:', error);
      // Even if logout fails, redirect to login
      router.replace('/admin/login');
      setIsLoggingOut(false);
    }
  };

  const navigateToMainApp = () => {
    router.push('/');
  };

  // Load files and analytics when user is authenticated
  useEffect(() => {
    // Wait for auth to complete and user to be available
    if (!loading && user?.email) {
      console.log('🔐 User authenticated, loading dashboard data...');
      loadFiles();
      loadAnalytics();
    }
  }, [user, loading]); // Run when user or loading state changes

  // Auto-refresh files every 30 seconds for real-time updates
  useEffect(() => {
    // Only set up auto-refresh if user is authenticated
    if (!user?.email) return;

    console.log('🔄 Setting up auto-refresh for file list (every 30 seconds)');
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing file list...');
      loadFiles();
    }, 30000); // 30 seconds

    // Cleanup interval on unmount
    return () => {
      console.log('🔄 Cleaning up auto-refresh interval');
      clearInterval(refreshInterval);
    };
  }, [user?.email]); // Re-setup if user changes

  return (
    <ProtectedRoute>
    <>
      <Head>
        <title>Admin Dashboard - AI PI</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <img src="/images/logo.svg" alt="AI PI Logo" className={styles.logo} />
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>AI PI Admin Dashboard</h1>
              <p className={styles.subtitle}>Welcome back, {user?.displayName || user?.email}</p>
            </div>
          </div>
          
          <div className={styles.headerActions}>
            <button
              onClick={navigateToMainApp}
              className={`${styles.button} ${styles.buttonSecondary}`}
            >
              View Main App
            </button>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`${styles.button} ${styles.buttonDanger}`}
            >
              {isLoggingOut ? (
                <>
                  <span className={styles.buttonSpinner}></span>
                  Logging out...
                </>
              ) : (
                'Logout'
              )}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className={styles.main}>
          {/* File Management */}
          <section className={styles.fileManagement}>
            <h2 className={styles.sectionTitle}>File Management</h2>
            
            {/* File Management Grid */}
            <div className={styles.fileManagementGrid}>
              {/* Upload Section */}
              <div className={styles.fileManagementSection}>
                <h3 className={styles.subsectionTitle}>Upload New File</h3>
                <form onSubmit={handleFileUpload} className={styles.uploadForm}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Select File:
                      <input
                        type="file"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        accept=".txt,.md"
                        className={styles.fileInput}
                        disabled={uploading}
                      />
                    </label>
                    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      Accepted formats: .txt, .md (max 4MB)
                    </p>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Description (optional):
                      <input
                        type="text"
                        value={uploadDescription}
                        onChange={(e) => setUploadDescription(e.target.value)}
                        placeholder="Brief description of the file content"
                        className={styles.textInput}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={!uploadFile || uploading}
                    className={`${styles.button} ${styles.buttonPrimary}`}
                  >
                    {uploading ? 'Uploading...' : 'Upload File'}
                  </button>
                </form>
              </div>

              {/* File List */}
              <div className={styles.fileManagementSection}>
                <div className={styles.fileListHeader}>
                  <h3 className={styles.subsectionTitle}>Uploaded Files</h3>
                  <button
                    onClick={loadFiles}
                    disabled={loadingFiles}
                    className={`${styles.button} ${styles.buttonSecondary} ${styles.smallButton}`}
                  >
                    {loadingFiles ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>

                {error && (
                  <div className={styles.errorMessage}>
                    Error: {error}
                  </div>
                )}

                {success && (
                  <div className={styles.successMessage}>
                    {success}
                  </div>
                )}

                {loadingFiles ? (
                  <div className={styles.loadingMessage}>Loading files...</div>
                ) : files.length === 0 ? (
                  <div className={styles.emptyMessage}>No files uploaded yet.</div>
                ) : (
                  <div className={styles.fileList}>
                    {files.map((file) => (
                      <div key={file.id} className={styles.fileItem}>
                        <div className={styles.fileInfo}>
                          <div className={styles.fileName}>{file.metadata.filename}</div>
                          <div className={styles.fileDetails}>
                            <span>Size: {formatFileSize(file.metadata.fileSize)}</span>
                            <span>Chunks: {file.metadata.chunkCount}</span>
                            <span>Uploaded: {formatDate(file.metadata.uploadDate)}</span>
                          </div>
                          {file.metadata.description && (
                            <div className={styles.fileDescription}>
                              {file.metadata.description}
                            </div>
                          )}
                        </div>
                        <div className={styles.fileActions}>
                          <button
                            onClick={() => setShowDeleteConfirm(file.metadata.filename)}
                            disabled={deleting === file.metadata.filename}
                            className={`${styles.button} ${styles.buttonDanger} ${styles.smallButton}`}
                          >
                            {deleting === file.metadata.filename ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Documentation Quality Analytics */}
          <section className={styles.fileManagement}>
            <div className={styles.fileListHeader}>
              <h2 className={styles.sectionTitle}>📊 Documentation Quality</h2>
              <button
                onClick={loadAnalytics}
                disabled={loadingAnalytics}
                className={`${styles.button} ${styles.buttonSecondary} ${styles.smallButton}`}
              >
                {loadingAnalytics ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {analyticsError && (
              <div className={styles.errorMessage}>
                Error loading analytics: {analyticsError}
              </div>
            )}

            {loadingAnalytics ? (
              <div className={styles.loadingMessage}>Loading analytics...</div>
            ) : analytics ? (
              <>
                {/* Summary Stats */}
                <div className={styles.fileManagementGrid} style={{ marginBottom: '24px' }}>
                  <div className={styles.fileManagementSection}>
                    <h3 className={styles.subsectionTitle}>RAG Performance Summary</h3>
                    <div style={{ padding: '16px', backgroundColor: '#1e293b', borderRadius: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                        <div>
                          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '4px' }}>Total Queries</p>
                          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#f1f5f9' }}>
                            {analytics.summary.totalQueries}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '4px' }}>RAG Success Rate</p>
                          <p style={{ fontSize: '24px', fontWeight: 'bold', color: analytics.summary.ragSuccessRate >= 70 ? '#22c55e' : analytics.summary.ragSuccessRate >= 50 ? '#f59e0b' : '#ef4444' }}>
                            {analytics.summary.ragSuccessRate.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '4px' }}>RAG Success</p>
                          <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#22c55e' }}>
                            {analytics.summary.ragSuccessCount} queries
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '4px' }}>General Fallback</p>
                          <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>
                            {analytics.summary.generalFallbackCount} queries
                          </p>
                        </div>
                      </div>
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
                        <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '4px' }}>Average Best Score</p>
                        <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#60a5fa' }}>
                          {analytics.summary.avgBestScore.toFixed(3)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Documentation Gaps */}
                <div className={styles.fileManagementGrid}>
                  <div className={styles.fileManagementSection}>
                    <h3 className={styles.subsectionTitle}>⚠️ Documentation Gaps</h3>
                    <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px' }}>
                      Questions that failed to find good documentation (confidence &lt; 0.6)
                    </p>
                    {analytics.documentationGaps.length === 0 ? (
                      <div className={styles.emptyMessage}>
                        ✅ No documentation gaps found! All queries are finding good matches.
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
                                <span>Best score: {gap.bestScore.toFixed(3)}</span>
                                <span>Top doc: {gap.topDocument}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Document Performance */}
                  <div className={styles.fileManagementSection}>
                    <h3 className={styles.subsectionTitle}>📄 Document Performance</h3>
                    <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px' }}>
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
                                {doc.status === 'excellent' && '⭐ '}
                                {doc.status === 'good' && '✅ '}
                                {doc.status === 'needs_improvement' && '⚠️ '}
                                {doc.filename}
                              </div>
                              <div className={styles.fileDetails}>
                                <span>Used in {doc.queryCount} queries</span>
                                <span>Avg score: {doc.averageScore.toFixed(3)}</span>
                                <span>High scores: {doc.highScoreCount}</span>
                                <span style={{ 
                                  color: doc.status === 'excellent' ? '#22c55e' : doc.status === 'good' ? '#60a5fa' : '#f59e0b',
                                  fontWeight: 'bold'
                                }}>
                                  {doc.status === 'excellent' ? 'Excellent' : doc.status === 'good' ? 'Good' : 'Needs Improvement'}
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
                No analytics data available yet. The system will start collecting data as users interact with the chatbot.
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
              Are you sure you want to delete "{showDeleteConfirm}"? This action cannot be undone.
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
                {deleting === showDeleteConfirm ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
    </ProtectedRoute>
  );
}
