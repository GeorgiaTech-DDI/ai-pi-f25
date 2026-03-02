import type { Metadata } from "next";
import "../styles/globals.css";
import { inter } from "../utils/fonts";
import Providers from "./providers/Providers";
import SessionWarning from "../components/SessionWarning";

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
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
          <SessionWarning />
        </Providers>
      </body>
    </html>
  );
}
