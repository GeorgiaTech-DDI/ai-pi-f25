import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";

export const auth = betterAuth({
  // ── JWT session (stateless, no DB needed) ──────────────────────────────────
  plugins: [
    jwt(), // stores session as a signed JWT cookie
    nextCookies(), // makes cookies work in Next.js Server Components / middleware
  ],

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.VERCEL_URL ?? process.env.BETTER_AUTH_URL,

  // ── Microsoft Entra ID provider ────────────────────────────────────────────
  socialProviders: {
    microsoft: {
      clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID as string,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET as string,
      // Setting the specific tenant ID makes Entra ID skip the personal
      // account picker and land directly on the Georgia Tech org login page.
      tenantId: process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID as string,
      scope: ["openid", "profile", "email", "User.Read"],
    },
  },

  // ── Restrict to @gatech.edu accounts ──────────────────────────────────────
  callbacks: {
    async signIn({ user }: { user: Record<string, any> }) {
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
