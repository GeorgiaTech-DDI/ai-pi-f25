import { Configuration, LogLevel, PublicClientApplication } from "@azure/msal-browser";

// MSAL configuration using environment variables
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID as string,
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID}`,
    redirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI || (typeof window !== "undefined" ? window.location.origin : undefined),
    postLogoutRedirectUri: process.env.NEXT_PUBLIC_AZURE_AD_POST_LOGOUT_REDIRECT_URI || (typeof window !== "undefined" ? window.location.origin : undefined),
    // Restrict to Georgia Tech tenant only for additional security
    knownAuthorities: [process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID ? `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID}` : undefined].filter(Boolean),
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
    // Shorter token expiration for enhanced security
    tokenRenewalOffsetSeconds: 300, // Renew tokens 5 minutes before expiry
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
        }
      },
    },
  },
};

export const loginRequest = {
  scopes: ["User.Read"], // Minimal scopes - only basic profile
  prompt: "select_account", // Always show account selector
  extraQueryParameters: {
    domain_hint: "gatech.edu" // Hint to show GT accounts first
  }
};

// Email domain validation for @gatech.edu users
export const validateGatechEmail = (email: string): boolean => {
  return email.toLowerCase().endsWith('@gatech.edu');
};

export const msalInstance = new PublicClientApplication(msalConfig);



