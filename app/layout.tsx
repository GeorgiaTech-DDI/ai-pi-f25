import type { Metadata } from "next";
import "../styles/globals.css";
import "../styles/theme.css";
import { inter } from "../utils/fonts";
import Providers from "./providers/Providers";

export const metadata: Metadata = {
  title: "AI PI",
  description:
    "AI-powered assistant for the Georgia Tech Invention Studio and General Makerspaces",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="root">
      <body className={`${inter.className}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
