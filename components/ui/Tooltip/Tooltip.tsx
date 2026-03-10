import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ComponentProps } from "react";
import { clsx } from "clsx";
import styles from "./Tooltip.module.css";

// ── Provider ──────────────────────────────────────────────────────────────────

export function TooltipProvider(
  props: ComponentProps<typeof BaseTooltip.Provider>,
) {
  return <BaseTooltip.Provider {...props} />;
}

// ── Root ──────────────────────────────────────────────────────────────────────

function TooltipRoot(props: ComponentProps<typeof BaseTooltip.Root>) {
  return <BaseTooltip.Root {...props} />;
}

// ── Trigger ───────────────────────────────────────────────────────────────────

function TooltipTrigger(props: ComponentProps<typeof BaseTooltip.Trigger>) {
  return <BaseTooltip.Trigger {...props} />;
}

// ── Portal ────────────────────────────────────────────────────────────────────

function TooltipPortal(props: ComponentProps<typeof BaseTooltip.Portal>) {
  return <BaseTooltip.Portal {...props} />;
}

// ── Positioner ────────────────────────────────────────────────────────────────

function TooltipPositioner({
  sideOffset = 6,
  ...props
}: ComponentProps<typeof BaseTooltip.Positioner>) {
  return <BaseTooltip.Positioner sideOffset={sideOffset} {...props} />;
}

// ── Popup ─────────────────────────────────────────────────────────────────────

function TooltipPopup({
  className,
  ...props
}: ComponentProps<typeof BaseTooltip.Popup>) {
  return (
    <BaseTooltip.Popup className={clsx(styles.Popup, className)} {...props} />
  );
}

// ── Arrow ─────────────────────────────────────────────────────────────────────

function TooltipArrow({
  className,
  ...props
}: ComponentProps<typeof BaseTooltip.Arrow>) {
  return (
    <BaseTooltip.Arrow className={clsx(styles.Arrow, className)} {...props}>
      <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
        <path
          d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H17.8683C16.8801 8 15.9269 7.63423 15.1924 6.97318L10.3356 2.60207C10.1465 2.42811 9.85348 2.42811 9.66437 2.60207Z"
          className={styles.ArrowFill}
        />
        <path
          d="M8.99542 1.85876C9.5447 1.35447 10.4553 1.35447 11.0046 1.85876L15.8614 6.22987C16.4103 6.73389 17.1246 7 17.8683 7H20V8H17.8683C16.8801 8 15.9269 7.63423 15.1924 6.97318L10.3356 2.60207C10.1465 2.42811 9.85348 2.42811 9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V7H2.13172C2.87538 7 3.58971 6.73389 4.13861 6.22987L8.99542 1.85876Z"
          className={styles.ArrowOuterStroke}
        />
        <path
          d="M8.99542 1.85876C9.5447 1.35447 10.4553 1.35447 11.0046 1.85876L15.8614 6.22987C16.4103 6.73389 17.1246 7 17.8683 7H20V8H17.8683C16.8801 8 15.9269 7.63423 15.1924 6.97318L10.3356 2.60207C10.1465 2.42811 9.85348 2.42811 9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V7H2.13172C2.87538 7 3.58971 6.73389 4.13861 6.22987L8.99542 1.85876Z"
          className={styles.ArrowInnerStroke}
        />
      </svg>
    </BaseTooltip.Arrow>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
// A flex container for grouping tooltip triggers side by side (e.g. toolbars).

function TooltipPanel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={clsx(styles.Panel, className)} {...props} />;
}

// ── Button ────────────────────────────────────────────────────────────────────
// Small icon-only button sized for use inside a TooltipPanel.

function TooltipButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return <button className={clsx(styles.Button, className)} {...props} />;
}

// ── Icon ──────────────────────────────────────────────────────────────────────
// Constrains an SVG icon to the standard 1rem size inside TooltipButton.

function TooltipIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return <svg className={clsx(styles.Icon, className)} {...props} />;
}

// ── Convenience compound wrapper ──────────────────────────────────────────────
// Usage:
//   <Tooltip tip="Save changes">
//     <Button variant="icon"><Save /></Button>
//   </Tooltip>

interface TooltipProps extends ComponentProps<typeof BaseTooltip.Root> {
  tip: React.ReactNode;
  children: React.ReactElement;
  delay?: number;
  showArrow?: boolean;
}

export function Tooltip({
  tip,
  children,
  showArrow = true,
  delay,
  ...props
}: TooltipProps) {
  return (
    <TooltipRoot {...props}>
      <TooltipTrigger delay={delay} render={children} />
      <TooltipPortal>
        <TooltipPositioner>
          <TooltipPopup>
            {showArrow && <TooltipArrow />}
            {tip}
          </TooltipPopup>
        </TooltipPositioner>
      </TooltipPortal>
    </TooltipRoot>
  );
}

// Named parts — shadcn style
Tooltip.Provider = TooltipProvider;
Tooltip.Root = TooltipRoot;
Tooltip.Trigger = TooltipTrigger;
Tooltip.Portal = TooltipPortal;
Tooltip.Positioner = TooltipPositioner;
Tooltip.Popup = TooltipPopup;
Tooltip.Arrow = TooltipArrow;
Tooltip.Panel = TooltipPanel;
Tooltip.Button = TooltipButton;
Tooltip.Icon = TooltipIcon;
Tooltip.createHandle = BaseTooltip.createHandle;
