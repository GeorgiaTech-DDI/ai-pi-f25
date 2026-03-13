import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";

/**
 * Automatically detects the URL based on Vercel's system variables.
 * This removes the need for a manual BETTER_AUTH_URL variable.
 */
const getBaseUrl = () => {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
};

const currentUrl = getBaseUrl();

export const auth = betterAuth({
  // ── URL Configuration ──────────────────────────────────────────────────────
  baseURL: currentUrl,
  trustedOrigins: [currentUrl],

  // ── Plugins ────────────────────────────────────────────────────────────────
  plugins: [
    jwt(), // Stateless JWT sessions
    nextCookies(), // Next.js cookie helper
  ],

  // Use the standard secret variable
  secret: process.env.BETTER_AUTH_SECRET,

  // ── Microsoft Entra ID (Georgia Tech) ──────────────────────────────────────
  socialProviders: {
    microsoft: {
      clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID as string,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET as string,
      tenantId: process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID as string,
      scope: ["openid", "profile", "email", "User.Read"],
    },
  },

  // ── Security Callbacks ─────────────────────────────────────────────────────
  callbacks: {
    async signIn({ user }: { user: Record<string, any> }) {
      // Force @gatech.edu emails only
      if (!user.email?.toLowerCase().endsWith("@gatech.edu")) {
        return {
          allowed: false,
          reason: "Only @gatech.edu accounts are allowed.",
        };
      }
      return { allowed: true };
    },
  },
});

export type Session = typeof auth.$Infer.Session;
