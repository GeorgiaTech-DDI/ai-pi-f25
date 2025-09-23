/**
 * Firebase Authentication Context
 * 
 * This context provides global authentication state throughout the application
 * using Firebase's onAuthStateChanged listener to track user authentication status.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';

// Create the AuthContext
const AuthContext = createContext({});

/**
 * AuthProvider component that wraps the app and provides authentication state
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('🔥 Setting up Firebase auth listener...');
    
    // Set up Firebase auth state listener
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        console.log('🔥 Auth state changed:', firebaseUser ? 'User logged in' : 'User logged out');
        
        if (firebaseUser) {
          // User is signed in
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            emailVerified: firebaseUser.emailVerified,
            displayName: firebaseUser.displayName || firebaseUser.email,
            role: 'admin' // Since this is the admin portal, all authenticated users are admins
          });
          setError(null);
        } else {
          // User is signed out
          setUser(null);
        }
        
        setLoading(false);
      },
      (authError) => {
        console.error('🔥 Firebase auth error:', authError);
        setError(authError.message);
        setUser(null);
        setLoading(false);
      }
    );

    // Cleanup function
    return () => {
      console.log('🔥 Cleaning up Firebase auth listener...');
      unsubscribe();
    };
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: !!user, // All authenticated users in admin portal are admins
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to use the AuthContext
 * Throws an error if used outside of AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

/**
 * Custom hook to get the current user
 * Returns null if not authenticated
 */
export function useUser() {
  const { user } = useAuth();
  return user;
}

/**
 * Custom hook to check if user is authenticated
 * Returns boolean
 */
export function useIsAuthenticated() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

export default AuthContext;
