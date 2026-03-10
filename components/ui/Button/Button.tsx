import { Button as BaseButton } from "@base-ui/react";
import type { ComponentProps } from "react";
import { clsx } from "clsx";
import Link from "next/link";
import styles from "./index.module.css";

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
}

export function Button({
  variant = "primary",
  href,
  className,
  ...props
}: ButtonProps) {
  const cls = clsx(
    styles.Button,
    variant !== "default" && styles[variant],
    className,
  );

  if (variant === "link") {
    return (
      <BaseButton
        render={<Link href={href ?? "/"} />}
        className={cls}
        {...props}
      />
    );
  }

  return <BaseButton className={cls} {...props} />;
}
