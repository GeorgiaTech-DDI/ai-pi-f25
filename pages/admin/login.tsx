import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useMsal } from '@azure/msal-react';
import { loginRequest, validateGatechEmail } from '../../lib/msal';
import styles from '../../styles/Login.module.css';
import posthog from 'posthog-js';

export default function AdminLogin() {
  const router = useRouter();
  const { instance, accounts } = useMsal();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    const account = accounts[0];
    if (account && validateGatechEmail(account.username)) {
      console.log('🔐 User already authenticated, redirecting to dashboard...');
      // Identify the admin in PostHog
      posthog.identify(account.username, {
        email: account.username,
        name: account.name,
        role: 'admin',
      });
      posthog.capture('admin_logged_in', {
        email: account.username,
        auth_provider: 'azure_ad',
      });
      router.push('/admin/dashboard');
    }
  }, [accounts, router]);

  const handleAzureLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      console.log('🔐 Initiating Azure OAuth login...');
      
      // Use redirect for login (more reliable than popup)
      // This will redirect to Azure AD, then back to this page
      await instance.loginRedirect({
        ...loginRequest,
        redirectStartPage: window.location.origin + '/admin/dashboard'
      });
      
      // Note: Code after loginRedirect won't execute as page redirects
    } catch (err: any) {
      console.error('🔐 Azure login error:', err);
      
      // Handle different error types
      let errorMessage = 'Login failed. Please try again.';
      
      if (err.message && err.message.includes('@gatech.edu')) {
        errorMessage = err.message;
      } else if (err.errorCode === 'user_cancelled') {
        errorMessage = 'Login was cancelled. Please try again.';
      } else if (err.errorCode === 'access_denied') {
        errorMessage = 'Access denied. Please contact your administrator.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      posthog.capture('admin_login_error', {
        error_code: err.errorCode || 'unknown',
        error_message: errorMessage,
      });
      posthog.captureException(err);
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Admin Login - AI PI</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.container}>
        <div className={styles.loginCard}>
          <div className={styles.logoSection}>
            <img src="/images/logo.svg" alt="AI PI Logo" className={styles.logo} />
            <h1 className={styles.title}>AI PI Admin Portal</h1>
            <p className={styles.subtitle}>Sign in with your Georgia Tech account</p>
          </div>

          <div className={styles.form}>
            {error && (
              <div className={styles.errorMessage}>
                <span className={styles.errorIcon}>⚠️</span>
                {error}
              </div>
            )}

            <button
              onClick={handleAzureLogin}
              disabled={isLoading}
              className={`${styles.submitButton} ${isLoading ? styles.submitButtonDisabled : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}
            >
              {isLoading ? (
                <span className={styles.loadingContainer}>
                  <span className={styles.spinner}></span>
                  Signing in...
                </span>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
                    <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
                    <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
                    <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
                  </svg>
                  Sign in with Microsoft
                </>
              )}
            </button>

            <p className={styles.subtitle} style={{ marginTop: '20px', fontSize: '14px', color: '#64748b' }}>
              Only @gatech.edu accounts are allowed
            </p>
          </div>

          <div className={styles.footer}>
            <p className={styles.disclaimer}>
              This is a secure admin portal. Unauthorized access is prohibited.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
