import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { jwt, oAuthProxy } from "better-auth/plugins";

const productionURL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;

const getBaseUrl = () => {
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return productionURL;
  }
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
};

const currentUrl = getBaseUrl();

export const auth = betterAuth({
  baseURL: currentUrl,

  trustedOrigins:
    process.env.VERCEL_ENV === "production"
      ? [productionURL, process.env.PREVIEW_URL_PATTERN as string]
      : [currentUrl],

  secret: process.env.BETTER_AUTH_SECRET,

  plugins: [
    jwt(),
    nextCookies(),
    oAuthProxy({
      productionURL,
      currentURL: currentUrl,
    }),
  ],

  socialProviders: {
    microsoft: {
      clientId: process.env.AZURE_AD_CLIENT_ID as string,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET as string,
      tenantId: process.env.AZURE_AD_TENANT_ID as string,
      redirectURI: `${productionURL}/api/auth/callback/microsoft`,
    },
  },

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
