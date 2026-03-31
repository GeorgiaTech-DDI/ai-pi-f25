import { Badge } from "@/components/ui/badge";
import HeaderButtons from "./components/header-buttons/header-buttons";
import Image from "next/image";
import Header from "@/components/header";

/**
 * Public route group layout — no auth required.
 * Thin passthrough; global providers are applied by the root app/layout.tsx.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <Header
        rightContent={<HeaderButtons className="flex items-center gap-x-1" />}
        leftItem={
          <Image
            src="/images/logo.svg"
            alt="AI PI Logo"
            className="h-8 w-auto"
            width={32}
            height={32}
          />
        }
      />
      <main
        data-autoscroll-container
        className="flex-1 overflow-x-hidden overflow-y-auto pt-6 [scrollbar-gutter:stable]"
      >
        {children}
      </main>
    </div>
  );
}
