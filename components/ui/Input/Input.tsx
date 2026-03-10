"use client";
import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentProps } from "react";
import { clsx } from "clsx";
import styles from "./Input.module.css";

export function Input({
  className,
  ...props
}: ComponentProps<typeof BaseInput>) {
  return <BaseInput className={clsx(styles.Input, className)} {...props} />;
}
