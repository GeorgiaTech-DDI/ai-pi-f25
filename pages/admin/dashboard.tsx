import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import styles from '../../styles/Dashboard.module.css';

interface DashboardStats {
  totalUsers: number;
  totalSessions: number;
  avgSessionLength: string;
  lastUpdated: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [stats] = useState<DashboardStats>({
    totalUsers: 1247,
    totalSessions: 3891,
    avgSessionLength: '12m 34s',
    lastUpdated: new Date().toLocaleString()
  });

  // Authentication is now handled by ProtectedRoute component

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      await signOut(auth);
      console.log('🔥 Firebase logout successful');
      // Firebase auth state change will be handled by AuthContext
      // ProtectedRoute will automatically redirect to login
    } catch (error) {
      console.error('🔥 Firebase logout error:', error);
      // Even if logout fails, redirect to login
      router.replace('/admin/login');
    } finally {
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
    </>
    </ProtectedRoute>
  );
}
