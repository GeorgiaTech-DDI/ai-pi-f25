/**
 * Azure MSAL Authentication Context
 * 
 * This context provides global authentication state throughout the application
 * using Microsoft Authentication Library (MSAL) to track user authentication status.
 * Only @gatech.edu users are allowed access.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { validateGatechEmail } from '../lib/msal';

// Define the user type
interface User {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  role: string;
}

// Define the context type
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

// Create the AuthContext
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  isAdmin: false,
});

/**
 * AuthProvider component that wraps the app and provides authentication state
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { instance, accounts, inProgress } = useMsal();

  useEffect(() => {
    console.log('🔐 Setting up MSAL auth listener...');
    
    // Handle MSAL authentication state changes
    if (inProgress === 'none') {
      const account = accounts[0];
      
      if (account) {
        console.log('🔐 MSAL account found:', account.username);
        
        // Validate email domain for @gatech.edu
        if (validateGatechEmail(account.username)) {
          setUser({
            uid: account.homeAccountId,
            email: account.username,
            emailVerified: true, // Azure AD emails are verified
            displayName: account.name || account.username,
            role: 'admin' // Since this is the admin portal, all authenticated users are admins
          });
          setError(null);
          console.log('✅ @gatech.edu user authenticated successfully');
        } else {
          console.log('❌ Non-@gatech.edu user detected, logging out...');
          setUser(null);
          setError('Only @gatech.edu email addresses are allowed');
          // Auto-logout non-gatech users
          instance.logoutPopup().catch(err => {
            console.error('Error during auto-logout:', err);
          });
        }
      } else {
        console.log('🔐 No MSAL account found');
        setUser(null);
        setError(null);
      }
      
      setLoading(false);
    }
  }, [accounts, inProgress, instance]);

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
export function useAuth(): AuthContextType {
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
export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

/**
 * Custom hook to check if user is authenticated
 * Returns boolean
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

export default AuthContext;
