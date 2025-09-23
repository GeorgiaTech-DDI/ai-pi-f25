import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../../styles/Login.module.css';

interface LoginFormData {
  username: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  user?: {
    username: string;
    role: string;
  };
  error?: string;
  retryAfter?: number;
}

export default function AdminLogin() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Basic client-side validation
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    setError('');
    setIsRateLimited(false);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password.trim(),
        }),
        credentials: 'include', // Include cookies in request
      });

      const data: LoginResponse = await response.json();

      if (response.ok && data.success) {
        // Successful login - redirect to admin dashboard
        router.push('/admin/dashboard');
      } else {
        // Handle different error types
        if (response.status === 429) {
          setIsRateLimited(true);
          setRetryAfter(data.retryAfter || 60);
          setError(`Too many login attempts. Please try again in ${data.retryAfter || 60} seconds.`);
          
          // Start countdown timer
          let countdown = data.retryAfter || 60;
          const timer = setInterval(() => {
            countdown -= 1;
            setRetryAfter(countdown);
            
            if (countdown <= 0) {
              clearInterval(timer);
              setIsRateLimited(false);
              setRetryAfter(0);
              setError('');
            }
          }, 1000);
        } else {
          setError(data.message || 'Login failed. Please check your credentials and try again.');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
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
            <p className={styles.subtitle}>Please sign in to access the admin dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="username" className={styles.label}>
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                disabled={isLoading || isRateLimited}
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={isLoading || isRateLimited}
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className={styles.errorMessage}>
                <span className={styles.errorIcon}>⚠️</span>
                {error}
                {isRateLimited && retryAfter > 0 && (
                  <span className={styles.countdown}> ({retryAfter}s)</span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isRateLimited}
              className={`${styles.submitButton} ${(isLoading || isRateLimited) ? styles.submitButtonDisabled : ''}`}
            >
              {isLoading ? (
                <span className={styles.loadingContainer}>
                  <span className={styles.spinner}></span>
                  Signing in...
                </span>
              ) : isRateLimited ? (
                `Try again in ${retryAfter}s`
              ) : (
                'Sign In'
              )}
            </button>
          </form>

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
