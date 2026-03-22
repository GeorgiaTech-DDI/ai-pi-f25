"use client";

import { useRef, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TermsOfServiceDialogProps {
  open: boolean;
  onAccept: () => void;
}

export default function TermsOfServiceDialog({
  open,
  onAccept,
}: TermsOfServiceDialogProps) {
  const tosContentRef = useRef<HTMLDivElement>(null);

  // State for scroll logic
  const [canAcceptTos, setCanAcceptTos] = useState(false);

  const [isPulsing, setIsPulsing] = useState(false);

  const handleCloseAttempt = () => {
    if (!canAcceptTos) return;

    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 150);
  };

  const checkScroll = () => {
    const element = tosContentRef.current;
    if (!element) return;

    // Check if content is scrollable (scrollHeight > clientHeight)
    const isScrollable = element.scrollHeight > element.clientHeight;

    // Check if user is at the bottom (with 10px buffer for zoom/scaling)
    const isAtBottom =
      element.scrollHeight - element.scrollTop <= element.clientHeight + 10;

    if (!isScrollable || isAtBottom) {
      setCanAcceptTos(true);
    }
  };

  // Re-calculate scrollability on open or window resize
  useEffect(() => {
    if (!open) return;

    const element = tosContentRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => checkScroll());
    observer.observe(element);

    // Initial check after paint
    const timeout = setTimeout(checkScroll, 50);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [open]);

  return (
    <Dialog open={open} closable={false} onCloseAttempt={handleCloseAttempt}>
      <DialogContent
        className="sm:max-w-[550px] flex flex-col max-h-[90vh]"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Terms of Service
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex-1 overflow-hidden">
          {/* Scrollable Body */}
          <div
            ref={tosContentRef}
            onScroll={checkScroll}
            className="h-[400px] overflow-y-auto pr-4 text-sm leading-relaxed text-muted-foreground space-y-4"
          >
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Understanding AI Limitations
              </h3>
              <p>
                Please be aware that AI responses may contain inaccuracies or
                errors. The AI has limited knowledge and may not have
                information on recent events. Always verify critical information
                from official sources.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Data Collection & Privacy
              </h3>
              <p>
                By using this service, you acknowledge and agree that your chat
                conversations may be logged and stored to improve the system's
                responses. Personal information should not be shared in your
                queries.
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Conversations are stored for training purposes.</li>
                <li>
                  Your feedback may be collected to enhance service quality.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Appropriate Use
              </h3>
              <p>
                This AI assistant is designed to provide information. You agree
                not to use this system to generate harmful, offensive, or
                inappropriate content or attempt to extract confidential data.
              </p>
            </section>

            <section className="pb-4">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Age Requirement
              </h3>
              <p>
                You must be at least 18 years of age or older to use this
                application. By accepting these terms, you confirm that you meet
                this requirement.
              </p>
            </section>
          </div>

          {/* Bottom Scroll Indicator Overlay */}
          {!canAcceptTos && (
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none flex flex-col items-center justify-end pb-2 animate-in fade-in duration-500">
              <div className="flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground">
                <span>Scroll to continue</span>
                <ChevronDown className="h-4 w-4 animate-bounce" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-3 pt-4 border-t">
          <Button
            onClick={onAccept}
            disabled={!canAcceptTos}
            className={cn(
              "min-w-[120px] transition-all duration-150 ease-in-out",
              // Pure Tailwind Scale Transition
              isPulsing
                ? "scale-110 shadow-md ring-2 ring-primary/50"
                : "scale-100",
            )}
          >
            Accept Terms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
