import type { Metadata } from "next";
import "../globals.css";
// import "../styles/theme.css";
import Providers from "./providers/Providers";
import { inter } from "@/lib/fonts";
import { cn } from "@/lib/utils";

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
    <html lang="en" className={cn(inter.variable, "h-full root")}>
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
