import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useMsal } from '@azure/msal-react';
import { useAuth } from '../../context/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import styles from '../../styles/Dashboard.module.css';

interface DashboardStats {
  totalUsers: number;
  totalSessions: number;
  avgSessionLength: string;
  lastUpdated: string;
}

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

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { instance } = useMsal();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [stats] = useState<DashboardStats>({
    totalUsers: 1247,
    totalSessions: 3891,
    avgSessionLength: '12m 34s',
    lastUpdated: new Date().toLocaleString()
  });

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

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

  // File management functions
  const loadFiles = async () => {
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
          {/* Stats Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>👥</div>
              <div className={styles.statContent}>
                <h3 className={styles.statNumber}>{stats.totalUsers.toLocaleString()}</h3>
                <p className={styles.statLabel}>Total Users</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>💬</div>
              <div className={styles.statContent}>
                <h3 className={styles.statNumber}>{stats.totalSessions.toLocaleString()}</h3>
                <p className={styles.statLabel}>Chat Sessions</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>⏱️</div>
              <div className={styles.statContent}>
                <h3 className={styles.statNumber}>{stats.avgSessionLength}</h3>
                <p className={styles.statLabel}>Avg Session Length</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>🔄</div>
              <div className={styles.statContent}>
                <h3 className={styles.statNumber}>Live</h3>
                <p className={styles.statLabel}>System Status</p>
              </div>
            </div>
          </div>

          {/* Dashboard Sections */}
          <div className={styles.dashboardGrid}>
            {/* Recent Activity */}
            <section className={styles.dashboardSection}>
              <h2 className={styles.sectionTitle}>Recent Activity</h2>
              <div className={styles.activityList}>
                <div className={styles.activityItem}>
                  <div className={styles.activityIcon}>📝</div>
                  <div className={styles.activityContent}>
                    <p className={styles.activityText}>New feedback submission received</p>
                    <p className={styles.activityTime}>2 minutes ago</p>
                  </div>
                </div>
                <div className={styles.activityItem}>
                  <div className={styles.activityIcon}>💬</div>
                  <div className={styles.activityContent}>
                    <p className={styles.activityText}>Chat session completed</p>
                    <p className={styles.activityTime}>5 minutes ago</p>
                  </div>
                </div>
                <div className={styles.activityItem}>
                  <div className={styles.activityIcon}>📊</div>
                  <div className={styles.activityContent}>
                    <p className={styles.activityText}>Weekly report generated</p>
                    <p className={styles.activityTime}>1 hour ago</p>
                  </div>
                </div>
              </div>
            </section>

            {/* System Information */}
            <section className={styles.dashboardSection}>
              <h2 className={styles.sectionTitle}>System Information</h2>
              <div className={styles.systemInfo}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Last Updated:</span>
                  <span className={styles.infoValue}>{stats.lastUpdated}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Environment:</span>
                  <span className={styles.infoValue}>
                    {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Version:</span>
                  <span className={styles.infoValue}>v1.0.0</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>API Status:</span>
                  <span className={`${styles.infoValue} ${styles.statusActive}`}>Active</span>
                </div>
              </div>
            </section>
          </div>

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

          {/* Quick Actions */}
          <section className={styles.quickActions}>
            <h2 className={styles.sectionTitle}>Quick Actions</h2>
            <div className={styles.actionsGrid}>
              <button className={`${styles.actionButton} ${styles.actionPrimary}`}>
                📊 View Analytics
              </button>
              <button className={`${styles.actionButton} ${styles.actionSecondary}`}>
                🔧 System Settings
              </button>
              <button className={`${styles.actionButton} ${styles.actionSecondary}`}>
                📝 Export Data
              </button>
              <button className={`${styles.actionButton} ${styles.actionSecondary}`}>
                👥 Manage Users
              </button>
            </div>
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
