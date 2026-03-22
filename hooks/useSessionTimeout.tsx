import { useState, useRef } from "react";
import { useIdleTimer } from "react-idle-timer";
import { toast } from "sonner";
import { AlarmClock } from "lucide-react";

export const IDLE_TIMEOUT = 1000 * 60 * 15; // 15 minutes
export const IDLE_PROMPT = 1000 * 60 * 1; // 1 minute before timeout

interface UseSessionTimeoutProps {
  onSessionExpire: () => void;
}

export function useSessionTimeout({ onSessionExpire }: UseSessionTimeoutProps) {
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const toastIdRef = useRef<string | number | null>(null);

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
        icon: <AlarmClock className="size-4 text-primary" />,
        duration: IDLE_PROMPT, // Show until idle occurs
      });
    },
    onAction: () => {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    },
    onIdle: () => {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      setIsSessionExpired(true);
      onSessionExpire(); // Execute the callback here
    },
    debounce: 500,
  });

  return { isSessionExpired, setIsSessionExpired, idleTimer };
}
