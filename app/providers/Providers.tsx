"use client";

/**
 * Providers
 *
 * With BetterAuth (server-side JWT sessions), we no longer need MSAL's
 * client-side provider tree or redirect handling. This component is now
 * a minimal passthrough — kept for future provider additions (e.g. PostHog).
 */

export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
