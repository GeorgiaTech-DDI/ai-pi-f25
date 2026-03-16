import type { Metadata } from "next";
import "../styles/globals.css";
import "../styles/theme.css";
import { inter } from "../utils/fonts";
import Providers from "./providers/Providers";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" className={cn("root", "font-sans", inter.variable)}>
      <body className={`${inter.className}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
