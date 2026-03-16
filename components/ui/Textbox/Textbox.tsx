"use client";
import React, { forwardRef, type TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";
import styles from "./Textbox.module.css";

export interface TextboxProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textbox = forwardRef<HTMLTextAreaElement, TextboxProps>(
  ({ className, invalid, disabled, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={clsx(styles.Textbox, className)}
        data-invalid={invalid ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        disabled={disabled}
        {...props}
      />
    );
  }
);
Textbox.displayName = "Textbox";
