import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { inter } from "../utils/fonts";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "../lib/msal";
import SessionWarning from "../components/SessionWarning";

// Inner component that can use AuthContext
function AppContent({ Component, pageProps }) {
  const { lastActivity, extendSession } = useAuth();
  
  return (
    <>
      <main className={`${inter.className}`}>
        <Component {...pageProps} />
        <Analytics />
        <SpeedInsights />
      </main>
      <SessionWarning lastActivity={lastActivity} onExtendSession={extendSession} />
    </>
  );
}

function MyApp({ Component, pageProps }) {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <AppContent Component={Component} pageProps={pageProps} />
      </AuthProvider>
    </MsalProvider>
  );
}

export default MyApp;
