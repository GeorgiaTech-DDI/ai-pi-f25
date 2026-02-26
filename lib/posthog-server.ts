import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!posthogKey) {
      throw new Error('NEXT_PUBLIC_POSTHOG_KEY is not defined');
    }

    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!posthogHost) {
      throw new Error('NEXT_PUBLIC_POSTHOG_HOST is not defined');
    }

    posthogClient = new PostHog(
      posthogKey,
      {
        host: posthogHost,
        flushAt: 1,
        flushInterval: 0,
      }
    );
  }
  return posthogClient;
}

export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}

export function registerPostHogShutdownHooks(): void {
  if (typeof process === 'undefined' || typeof process.on !== 'function') {
    return;
  }

  // Flush events when the event loop is about to become empty
  process.once('beforeExit', () => {
    void shutdownPostHog();
  });

  const handleSignal = async () => {
    try {
      await shutdownPostHog();
    } finally {
      // Ensure the process actually terminates after flushing events
      process.exit(0);
    }
  };

  process.once('SIGINT', () => {
    void handleSignal();
  });

  process.once('SIGTERM', () => {
    void handleSignal();
  });
}

// Register shutdown hooks as soon as this module is loaded
registerPostHogShutdownHooks();
