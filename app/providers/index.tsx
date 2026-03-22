"use client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionTimeoutProvider } from "@/app/providers/session-timeout-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  const queryClient = new QueryClient();

  useEffect(() => {
    if (session?.user?.email) {
      posthog.identify(session.user.email, { email: session.user.email });
    } else {
      posthog.reset();
    }
  }, [session]);

  return (
    <PostHogProvider client={posthog}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SessionTimeoutProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </SessionTimeoutProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </PostHogProvider>
  );
}
