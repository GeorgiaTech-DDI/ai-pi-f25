import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import styles from '../../styles/Login.module.css';

interface LoginFormData {
  username: string; // Will be used as email for Firebase Auth
  password: string;
}

export default function AdminLogin() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Use Firebase Authentication
      await signInWithEmailAndPassword(auth, formData.username.trim(), formData.password.trim());
      
      // Successful login - redirect to admin dashboard
      router.push('/admin/dashboard');
    } catch (err: any) {
      console.error('Firebase login error:', err);
      
      // Handle Firebase Auth errors
      let errorMessage = 'Login failed. Please check your credentials and try again.';
      
      if (err.code) {
        switch (err.code) {
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled. Please contact support.';
            break;
          case 'auth/user-not-found':
            errorMessage = 'Invalid email or password. Please check your credentials.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Invalid email or password. Please check your credentials.';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'Invalid email or password. Please check your credentials.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed login attempts. Please try again later.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your connection and try again.';
            break;
          default:
            errorMessage = 'Login failed. Please try again.';
        }
      }
      
      setError(errorMessage);
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
                Email
              </label>
              <input
                type="email"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                disabled={isLoading}
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                placeholder="Enter your email"
                autoComplete="email"
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
                disabled={isLoading}
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className={styles.errorMessage}>
                <span className={styles.errorIcon}>⚠️</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`${styles.submitButton} ${isLoading ? styles.submitButtonDisabled : ''}`}
            >
              {isLoading ? (
                <span className={styles.loadingContainer}>
                  <span className={styles.spinner}></span>
                  Signing in...
                </span>
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
