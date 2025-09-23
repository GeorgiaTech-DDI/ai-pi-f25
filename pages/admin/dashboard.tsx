import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { checkAuthStatus, logout } from '../../utils/authUtils';
import styles from '../../styles/Dashboard.module.css';

interface User {
  username: string;
  role: string;
}

interface DashboardStats {
  totalUsers: number;
  totalSessions: number;
  avgSessionLength: string;
  lastUpdated: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [stats] = useState<DashboardStats>({
    totalUsers: 1247,
    totalSessions: 3891,
    avgSessionLength: '12m 34s',
    lastUpdated: new Date().toLocaleString()
  });

  useEffect(() => {
    // Check authentication status on component mount
    const verifyAuth = async () => {
      try {
        const authenticatedUser = await checkAuthStatus();
        
        if (authenticatedUser) {
          setUser(authenticatedUser as User);
        } else {
          // Redirect to login if not authenticated
          router.replace('/admin/login');
          return;
        }
      } catch (error) {
        console.error('Auth verification error:', error);
        router.replace('/admin/login');
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      const success = await logout();
      
      if (success) {
        // Clear user state and redirect to login
        setUser(null);
        router.replace('/admin/login');
      } else {
        console.error('Logout failed');
        // Even if logout API fails, clear local state and redirect
        setUser(null);
        router.replace('/admin/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: clear state and redirect anyway
      setUser(null);
      router.replace('/admin/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navigateToMainApp = () => {
    router.push('/');
  };

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Verifying authentication...</p>
      </div>
    );
  }

  // Don't render anything if user is not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
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
              <p className={styles.subtitle}>Welcome back, {user.username}</p>
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
  );
}
