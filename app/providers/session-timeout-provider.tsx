"use client";

import { createContext, useRef, useState, useCallback, ReactNode } from "react";
import { useIdleTimer } from "react-idle-timer";
import { toast } from "sonner";
import { AlarmClock } from "lucide-react";

export const IDLE_TIMEOUT = 1000 * 60 * 15; // 15 minutes
export const IDLE_PROMPT = 1000 * 60 * 1; // 1 minute before timeout

export interface SessionTimeoutContextType {
  isSessionExpired: boolean;
  setIsSessionExpired: (val: boolean) => void;
  resetTimer: () => void;
  registerListener: (fn: () => void) => void;
  unregisterListener: (fn: () => void) => void;
}

export const SessionTimeoutContext =
  createContext<SessionTimeoutContextType | null>(null);

export function SessionTimeoutProvider({ children }: { children: ReactNode }) {
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const toastIdRef = useRef<string | number | null>(null);
  const listenersRef = useRef(new Set<() => void>());

  const idleTimer = useIdleTimer({
    timeout: IDLE_TIMEOUT,
    promptBeforeIdle: IDLE_PROMPT,
    onPrompt: () => {
      toastIdRef.current = toast("Are you still there?", {
        description: "Your session will expire soon due to inactivity.",
        action: {
          label: "Stay Active",
          onClick: () => idleTimer.reset(),
        },
        icon: <AlarmClock className="text-primary size-4" />,
        duration: IDLE_PROMPT, // Show until idle occurs
      });
    },
    onAction: () => {
      if (toastIdRef.current != null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    },
    onIdle: () => {
      if (toastIdRef.current != null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      setIsSessionExpired(true);

      // Execute all registered listeners
      listenersRef.current.forEach((fn) => fn());
    },
    debounce: 500,
  });

  const registerListener = useCallback((fn: () => void) => {
    listenersRef.current.add(fn);
  }, []);

  const unregisterListener = useCallback((fn: () => void) => {
    listenersRef.current.delete(fn);
  }, []);

  return (
    <SessionTimeoutContext.Provider
      value={{
        isSessionExpired,
        setIsSessionExpired,
        resetTimer: () => idleTimer.reset(),
        registerListener,
        unregisterListener,
      }}
    >
      {children}
    </SessionTimeoutContext.Provider>
  );
}
