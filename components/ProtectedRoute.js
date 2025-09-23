/**
 * ProtectedRoute Component
 * 
 * This component wraps protected pages (like the admin dashboard) and ensures
 * only authenticated users can access them. It handles:
 * - Loading states while checking authentication
 * - Redirecting unauthenticated users to login
 * - Rendering protected content for authenticated users
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if we're not loading and user is not authenticated
    if (!loading && !isAuthenticated) {
      console.log('🔒 Access denied - redirecting to login');
      router.replace('/admin/login');
    }
  }, [loading, isAuthenticated, router]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{
          marginTop: '16px',
          color: '#64748b',
          fontSize: '14px'
        }}>
          Checking authentication...
        </p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Don't render anything while redirecting
  if (!isAuthenticated) {
    return null;
  }

  // User is authenticated - render the protected content
  console.log('🔒 Access granted - user authenticated:', user?.email);
  return children;
}
