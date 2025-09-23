import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { inter } from "../utils/fonts";
import { AuthProvider } from "../context/AuthContext";

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <main className={`${inter.className}`}>
        <Component {...pageProps} />
        <Analytics />
        <SpeedInsights />
      </main>
    </AuthProvider>
  );
}

export default MyApp;
