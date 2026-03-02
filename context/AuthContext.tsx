/**
 * Azure MSAL Authentication Context
 *
 * This context provides global authentication state throughout the application
 * using Microsoft Authentication Library (MSAL) to track user authentication status.
 * Only @gatech.edu users are allowed access.
 */

"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { validateGatechEmail } from "../lib/msal";

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

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
  lastActivity: number;
  extendSession: () => void;
}

// Create the AuthContext
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  isAdmin: false,
  lastActivity: Date.now(),
  extendSession: () => {},
});

/**
 * AuthProvider component that wraps the app and provides authentication state
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const { instance, accounts, inProgress } = useMsal();

  // Session timeout check — logs out after 30 minutes of inactivity
  useEffect(() => {
    if (!user) return;
    const checkSession = () => {
      if (Date.now() - lastActivity > SESSION_TIMEOUT) {
        console.log("🔐 Session timeout — logging out user");
        instance
          .logoutPopup({
            postLogoutRedirectUri: window.location.origin,
          })
          .catch((err) =>
            console.error("🔐 Session timeout logout error:", err),
          );
      }
    };
    const interval = setInterval(checkSession, 60_000);
    return () => clearInterval(interval);
  }, [user, lastActivity, instance]);

  // Track user activity to reset the inactivity timer
  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now());
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ] as const;
    events.forEach((e) => document.addEventListener(e, updateActivity, true));
    return () =>
      events.forEach((e) =>
        document.removeEventListener(e, updateActivity, true),
      );
  }, []);

  useEffect(() => {
    console.log("🔐 AuthContext: Setting up MSAL auth listener...");
    console.log("🔐 AuthContext: inProgress =", inProgress);
    console.log("🔐 AuthContext: accounts =", accounts);

    if (
      inProgress === InteractionStatus.Startup ||
      inProgress === InteractionStatus.HandleRedirect
    ) {
      setLoading(true);
      return;
    }

    const account = accounts[0];
    if (account) {
      console.log("🔐 AuthContext: MSAL account found:", account.username);
      if (validateGatechEmail(account.username)) {
        setUser({
          uid: account.homeAccountId,
          email: account.username,
          emailVerified: true,
          displayName: account.name || account.username,
          role: "admin",
        });
        setError(null);
        setLastActivity(Date.now()); // Reset timer on fresh login
        console.log(
          "✅ AuthContext: @gatech.edu user authenticated successfully",
        );
      } else {
        console.log(
          "❌ AuthContext: Non-@gatech.edu user detected, logging out...",
        );
        setUser(null);
        setError("Only @gatech.edu email addresses are allowed");
        instance
          .logoutRedirect({
            postLogoutRedirectUri: window.location.origin + "/admin/login",
          })
          .catch((err) => console.error("Error during auto-logout:", err));
      }
    } else {
      console.log(
        "🔐 AuthContext: No MSAL account found, setting user to null",
      );
      setUser(null);
      setError(null);
    }

    setLoading(false);
  }, [accounts, inProgress, instance]);

  const extendSession = () => {
    setLastActivity(Date.now());
    console.log("🔐 Session extended by user");
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: !!user,
    lastActivity,
    extendSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to use the AuthContext
 * Throws an error if used outside of AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
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
