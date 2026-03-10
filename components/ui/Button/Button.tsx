import { Button as BaseButton } from "@base-ui/react";
import type { ComponentProps } from "react";
import { clsx } from "clsx";
import Link from "next/link";
import { Tooltip } from "../Tooltip";
import styles from "./Button.module.css";

export type ButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "ghost"
  | "icon"
  | "link"
  | "emphasis";

interface ButtonProps extends ComponentProps<typeof BaseButton> {
  variant?: ButtonVariant;
  /** Required when variant="link" */
  href?: string;
  /** Wraps the button in a Tooltip when provided */
  tooltip?: React.ReactNode;
  /** When combined with variant="icon", removes border and background */
  ghost?: boolean;
}

export function Button({
  variant = "primary",
  href,
  tooltip,
  ghost,
  className,
  ...props
}: ButtonProps) {
  const cls = clsx(
    styles.Button,
    variant !== "default" && styles[variant],
    ghost && variant === "icon" && styles.iconGhost,
    className,
  );

  let button: React.ReactElement;

  if (variant === "link") {
    button = (
      <BaseButton
        render={<Link href={href ?? "/"} />}
        className={cls}
        {...props}
      />
    );
  } else {
    button = <BaseButton className={cls} {...props} />;
  }

  if (tooltip) {
    return (
      <Tooltip delay={50} tip={tooltip}>
        {button}
      </Tooltip>
    );
  }

  return button;
}
