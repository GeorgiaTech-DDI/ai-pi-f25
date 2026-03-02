"use client";

/**
 * Admin route group layout — auth guard.
 *
 * Replaces the legacy components/ProtectedRoute.js. All routes nested under
 * app/(admin)/ automatically require authentication: unauthenticated visitors
 * are redirected to /admin/login.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

function Spinner() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
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
      <p style={{ marginTop: "16px", color: "#64748b", fontSize: "14px" }}>
        Checking authentication...
      </p>
      <style>{`
        @keyframes spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      console.log("🔒 Access denied — redirecting to login");
      router.replace("/admin/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) return <Spinner />;

  // Don't render children while redirect is in flight
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
