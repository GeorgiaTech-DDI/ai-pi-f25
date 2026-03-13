"use client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";
import { useSession } from "../../lib/auth-client";

export default function Providers({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.email) {
      posthog.identify(session.user.email, { email: session.user.email });
    } else {
      posthog.reset();
    }
  }, [session]);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
