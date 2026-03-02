"use client";

/**
 * Providers
 *
 * Client-side provider tree that replaces the _app.js wrapper logic:
 * - Initializes MSAL and handles the Azure AD redirect promise before rendering
 * - Wraps children in MsalProvider + AuthProvider
 */

import { useState, useEffect } from "react";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance, validateGatechEmail } from "../../lib/msal";
import { AuthProvider } from "../../context/AuthContext";

function Spinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "4px solid #e2e8f0",
          borderTop: "4px solid #3b82f6",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`
        @keyframes spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initMsal = async () => {
      try {
        console.log("🔐 Initializing MSAL...");
        await msalInstance.initialize();
        console.log("✅ MSAL initialized successfully");

        console.log("🔐 Starting handleRedirectPromise...");
        const response = await msalInstance.handleRedirectPromise();
        console.log("🔐 handleRedirectPromise completed. Response:", response);
        console.log("🔐 Current accounts:", msalInstance.getAllAccounts());

        if (response) {
          const email = response.account.username;
          if (!validateGatechEmail(email)) {
            console.error("🔐 Invalid email domain:", email);
            await msalInstance.logoutRedirect({
              account: response.account,
              postLogoutRedirectUri: window.location.origin + "/admin/login",
            });
            alert(
              "Only @gatech.edu email addresses are allowed to access this portal.",
            );
            return;
          }
          console.log("✅ Valid @gatech.edu user authenticated:", email);
        } else {
          console.log(
            "🔐 No redirect response (first load or already authenticated)",
          );
        }
      } catch (error) {
        console.error("🔐 Error during MSAL initialization:", error);
      } finally {
        setReady(true);
      }
    };

    initMsal();
  }, []);

  if (!ready) return <Spinner />;

  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>{children}</AuthProvider>
    </MsalProvider>
  );
}
