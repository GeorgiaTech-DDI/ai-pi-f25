"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "../../../../lib/auth-client";
import styles from "@/styles/Login.module.css";

export default function AdminLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      await signIn.social({
        provider: "microsoft",
        callbackURL: "/admin/dashboard",
      });
      // Page will redirect — no further code runs here
    } catch (err: any) {
      let errorMessage = "Login failed. Please try again.";
      if (err?.message?.includes("@gatech.edu")) {
        errorMessage = "Only @gatech.edu accounts are allowed.";
      } else if (err?.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.logoSection}>
          <img
            src="/images/logo.svg"
            alt="AI PI Logo"
            className={styles.logo}
          />
          <h1 className={styles.title}>AI PI Admin Portal</h1>
          <p className={styles.subtitle}>
            Sign in with your Georgia Tech account
          </p>
        </div>

        <div className={styles.form}>
          {error && (
            <div className={styles.errorMessage}>
              <span className={styles.errorIcon}>⚠️</span>
              {error}
            </div>
          )}

          <button
            onClick={handleMicrosoftLogin}
            disabled={isLoading}
            className={`${styles.submitButton} ${isLoading ? styles.submitButtonDisabled : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            {isLoading ? (
              <span className={styles.loadingContainer}>
                <span className={styles.spinner} />
                Signing in...
              </span>
            ) : (
              <>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 21 21"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M10 0H0V10H10V0Z" fill="#F25022" />
                  <path d="M21 0H11V10H21V0Z" fill="#7FBA00" />
                  <path d="M10 11H0V21H10V11Z" fill="#00A4EF" />
                  <path d="M21 11H11V21H21V11Z" fill="#FFB900" />
                </svg>
                Sign in with Microsoft
              </>
            )}
          </button>

          <p
            className={styles.subtitle}
            style={{ marginTop: "20px", fontSize: "14px", color: "#64748b" }}
          >
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
  );
}
