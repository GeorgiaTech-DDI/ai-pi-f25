import { useRef, useCallback, useEffect } from "react";

const SCROLL_MARGIN_TOP = 24;

export function useScrollToLatestUserMsg(messages: { role: string }[]) {
  const spacerRef = useRef<HTMLDivElement>(null);
  const shrinkObserverRef = useRef<ResizeObserver | null>(null);

  const snapToMessage = useCallback(() => {
    const container = document.querySelector<HTMLElement>(
      "[data-autoscroll-container]",
    );
    const header = document.querySelector<HTMLElement>("[data-header]");
    const chatbox = document.querySelector<HTMLElement>(
      "[data-chatbox-container]",
    );
    const spacer = spacerRef.current;
    if (!container || !spacer) return;

    const userMsgs =
      container.querySelectorAll<HTMLElement>('[data-role="user"]');
    const target = userMsgs[userMsgs.length - 1];
    if (!target) return;

    const headerHeight = header?.offsetHeight ?? 0;
    const chatboxHeight = chatbox?.offsetHeight ?? 0;
    const userMsgHeight = target.offsetHeight;
    const initialSpacerHeight =
      window.innerHeight -
      headerHeight -
      chatboxHeight -
      userMsgHeight -
      SCROLL_MARGIN_TOP;
    spacer.style.height = `${Math.max(0, initialSpacerHeight)}px`;

    shrinkObserverRef.current?.disconnect();

    // Scroll immediately — AI response doesn't need to exist yet
    requestAnimationFrame(() => {
      const containerBCR = container.getBoundingClientRect();
      const msgRect = target.getBoundingClientRect();
      const targetScrollTop =
        container.scrollTop +
        (msgRect.top - containerBCR.top) -
        SCROLL_MARGIN_TOP;
      container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    });

    // Poll for the AI response sibling, ignoring the spacer div
    const waitForAiResponse = () => {
      const aiResponse = target.nextElementSibling as HTMLElement | null;
      if (!aiResponse || aiResponse.getAttribute("data-role") !== "assistant") {
        requestAnimationFrame(waitForAiResponse);
        return;
      }
      shrinkObserverRef.current = new ResizeObserver(() => {
        const aiHeight = aiResponse.offsetHeight;
        const newSpacerHeight = initialSpacerHeight - aiHeight;
        if (newSpacerHeight <= 0) {
          spacer.style.height = "0px";
          shrinkObserverRef.current?.disconnect();
        } else {
          spacer.style.height = `${newSpacerHeight}px`;
        }
      });
      shrinkObserverRef.current.observe(aiResponse);
    };

    requestAnimationFrame(waitForAiResponse);
  }, []);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user") return;

    const id = setTimeout(() => {
      requestAnimationFrame(() => snapToMessage());
    }, 0);

    return () => clearTimeout(id);
  }, [messages.length, snapToMessage]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => shrinkObserverRef.current?.disconnect();
  }, []);

  return { spacerRef };
}
