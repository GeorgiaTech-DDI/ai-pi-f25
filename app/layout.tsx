import type { Metadata } from "next";
import "../globals.css";
// import "../styles/theme.css";
import { inter } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import Providers from "./providers";
import { Toaster } from "@/components/ui/sonner";

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
    <html
      lang="en"
      className={cn(inter.variable, "root h-full")}
      suppressHydrationWarning
    >
      <body className="h-full">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
