"use client";

/**
 * Session Warning Component
 *
 * Shows a warning to users before their session times out due to inactivity.
 * Reads lastActivity and extendSession directly from AuthContext (no props needed).
 */

import { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { useAuth } from "../context/AuthContext";

const SESSION_WARNING_TIME = 5 * 60 * 1000; // Show warning 5 minutes before timeout
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes total

export default function SessionWarning() {
  const { instance } = useMsal();
  const { lastActivity, extendSession } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!lastActivity) return;

    const checkSession = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      const timeUntilTimeout = SESSION_TIMEOUT - timeSinceActivity;
      const timeUntilWarning =
        SESSION_TIMEOUT - SESSION_WARNING_TIME - timeSinceActivity;

      if (timeUntilTimeout <= 0) {
        setShowWarning(false);
        instance
          .logoutPopup({
            postLogoutRedirectUri: window.location.origin,
          })
          .catch((err) =>
            console.error("🔐 Session timeout logout error:", err),
          );
      } else if (timeUntilWarning <= 0 && timeUntilTimeout > 0) {
        setShowWarning(true);
        setTimeRemaining(Math.ceil(timeUntilTimeout / 1000));
      } else {
        setShowWarning(false);
      }
    };

    const interval = setInterval(checkSession, 1000);
    checkSession();
    return () => clearInterval(interval);
  }, [lastActivity, instance]);

  const handleExtendSession = () => {
    extendSession();
    setShowWarning(false);
  };

  const handleLogout = () => {
    setShowWarning(false);
    instance
      .logoutPopup({
        postLogoutRedirectUri: window.location.origin,
      })
      .catch((err) => console.error("🔐 Logout error:", err));
  };

  if (!showWarning) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
          maxWidth: "400px",
          width: "90%",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "24px", marginBottom: "16px" }}>⏰</div>

        <h3
          style={{
            margin: "0 0 12px 0",
            color: "#1f2937",
            fontSize: "18px",
            fontWeight: "600",
          }}
        >
          Session Timeout Warning
        </h3>

        <p
          style={{
            margin: "0 0 20px 0",
            color: "#6b7280",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          Your session will expire in{" "}
          <strong>
            {Math.floor(timeRemaining / 60)}:
            {(timeRemaining % 60).toString().padStart(2, "0")}
          </strong>{" "}
          due to inactivity.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={handleExtendSession}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Extend Session
          </button>

          <button
            onClick={handleLogout}
            style={{
              backgroundColor: "#ef4444",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Logout Now
          </button>
        </div>

        <p style={{ margin: "16px 0 0 0", color: "#9ca3af", fontSize: "12px" }}>
          Click anywhere outside this dialog to dismiss
        </p>
      </div>
    </div>
  );
}
