/**
 * Azure MSAL Authentication Context
 * 
 * This context provides global authentication state throughout the application
 * using Azure MSAL to track user authentication status.
 * Only allows @gatech.edu email addresses.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { validateGatechEmail } from '../lib/msal';

// Create the AuthContext
const AuthContext = createContext({});

/**
 * AuthProvider component that wraps the app and provides authentication state
 */
export function AuthProvider({ children }) {
  const { instance, accounts, inProgress } = useMsal();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastActivity, setLastActivity] = useState(Date.now());
  
  // Session timeout after 30 minutes of inactivity (enhanced security)
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  // Session timeout effect
  useEffect(() => {
    if (!user) return;

    const checkSessionTimeout = () => {
      const now = Date.now();
      if (now - lastActivity > SESSION_TIMEOUT) {
        console.log('🔐 Session timeout - logging out user');
        instance.logoutPopup({
          postLogoutRedirectUri: window.location.origin
        }).catch(err => {
          console.error('🔐 Session timeout logout error:', err);
        });
      }
    };

    const interval = setInterval(checkSessionTimeout, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [user, lastActivity, instance, SESSION_TIMEOUT]);

  // Activity tracking effect
  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now());
    
    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
    };
  }, []);

  useEffect(() => {
    console.log('🔐 Setting up Azure MSAL auth listener...');
    console.log('🔐 Accounts:', accounts);
    console.log('🔐 Interaction status:', inProgress);

    // Wait for MSAL to finish initializing
    if (inProgress === InteractionStatus.Startup || inProgress === InteractionStatus.HandleRedirect) {
      console.log('🔐 MSAL is initializing...');
      setLoading(true);
      return;
    }

    // Check if user is authenticated
    const account = accounts[0];
    
    if (account) {
      const email = account.username || account.email;
      console.log('🔐 User account found:', email);

      // Validate email domain
      if (validateGatechEmail(email)) {
        console.log('🔐 Valid @gatech.edu email - user authenticated');
        setUser({
          uid: account.homeAccountId,
          email: email,
          emailVerified: true,
          displayName: account.name || email,
          role: 'admin' // All authenticated @gatech.edu users are admins
        });
        setError(null);
        setLastActivity(Date.now()); // Reset activity timer on successful login
      } else {
        console.error('🔐 Invalid email domain - not @gatech.edu');
        setError('Only @gatech.edu email addresses are allowed');
        setUser(null);
        
        // Auto-logout users with invalid email domains
        instance.logoutPopup({
          account: account,
          postLogoutRedirectUri: window.location.origin
        }).catch(err => {
          console.error('🔐 Logout error:', err);
        });
      }
    } else {
      console.log('🔐 No user account found - user not authenticated');
      setUser(null);
      setError(null);
    }

    setLoading(false);
  }, [accounts, inProgress, instance]);

  const extendSession = () => {
    setLastActivity(Date.now());
    console.log('🔐 Session extended by user activity');
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: !!user, // All authenticated users in admin portal are admins
    lastActivity,
    extendSession,
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
