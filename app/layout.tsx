import { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Home',
  description: 'The main page of the app',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
