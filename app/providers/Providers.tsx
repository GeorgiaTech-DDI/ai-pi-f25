"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "../../lib/auth-client";

/** Fires a $pageview on every client-side navigation */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname, searchParams]);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  // Initialise posthog-js once on mount
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      person_profiles: "always", // capture anonymous + identified users
      capture_pageview: false, // handled manually via PostHogPageView
    });
  }, []);

  // Identify when logged in, reset to anonymous on logout
  useEffect(() => {
    if (session?.user?.email) {
      posthog.identify(session.user.email, {
        name: session.user.name ?? undefined,
        email: session.user.email,
      });
    } else {
      posthog.reset();
    }
  }, [session]);

  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
