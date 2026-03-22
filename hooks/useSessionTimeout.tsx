import { useContext, useEffect, useRef } from "react";
import { SessionTimeoutContext } from "@/app/providers/session-timeout-provider";

interface UseSessionTimeoutProps {
  onSessionExpire?: () => void;
}

export function useSessionTimeout({
  onSessionExpire,
}: UseSessionTimeoutProps = {}) {
  const context = useContext(SessionTimeoutContext);

  if (!context) {
    throw new Error(
      "useSessionTimeout must be used within a SessionTimeoutProvider",
    );
  }

  const callbackRef = useRef(onSessionExpire);

  useEffect(() => {
    callbackRef.current = onSessionExpire;
  }, [onSessionExpire]);

  useEffect(() => {
    const handler = () => {
      if (callbackRef.current) {
        callbackRef.current();
      }
    };

    context.registerListener(handler);
    return () => context.unregisterListener(handler);
  }, [context]);

  return {
    isSessionExpired: context.isSessionExpired,
    setIsSessionExpired: context.setIsSessionExpired,
    idleTimer: { reset: context.resetTimer },
  };
}
