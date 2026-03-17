import { useRef, useCallback, useEffect } from "react";

const HEADER_HEIGHT = 0; // your containerBCR.top shows header is 68px, not 80px

export function useScrollToLatestUserMsg(messages: { role: string }[]) {
  const spacerRef = useRef<HTMLDivElement>(null);

  const snapToMessage = useCallback(() => {
    const container = document.getElementById("scroll-container");
    const spacer = spacerRef.current;
    if (!container || !spacer) return;

    const userMsgs =
      container.querySelectorAll<HTMLElement>('[data-role="user"]');
    const target = userMsgs[userMsgs.length - 1];
    if (!target) return;

    requestAnimationFrame(() => {
      const viewportH = window.innerHeight;
      const targetH = target.offsetHeight;
      const msgRect = target.getBoundingClientRect();
      const containerBCR = container.getBoundingClientRect();

      const spaceBelow = containerBCR.bottom - msgRect.bottom;
      const runwayNeeded = viewportH - HEADER_HEIGHT - targetH;
      const deficit = runwayNeeded - spaceBelow;

      spacer.style.height = `${Math.max(0, deficit)}px`;

      requestAnimationFrame(() => {
        // offsetTop is relative to offsetParent, not to <main>.
        // Walk up the tree summing offsets until we reach the container.
        let offsetTop = 0;
        let el: HTMLElement | null = target;
        while (el && el !== container) {
          offsetTop += el.offsetTop;
          el = el.offsetParent as HTMLElement | null;
        }

        container.scrollTo({
          top: offsetTop - HEADER_HEIGHT,
          behavior: "smooth",
        });
      });
    });
  }, []);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user") return;

    const id = setTimeout(() => snapToMessage(), 0);
    return () => clearTimeout(id);
  }, [messages.length, snapToMessage]);

  return { spacerRef };
}
