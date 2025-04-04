import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { inter } from "../utils/fonts";

function MyApp({ Component, pageProps }) {
  return (
    <main className={`${inter.className}`}>
      <Component {...pageProps} />
      <Analytics />
      <SpeedInsights />
    </main>
  );
}

export default MyApp;
