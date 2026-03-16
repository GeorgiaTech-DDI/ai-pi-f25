import { Form as BaseForm } from "@base-ui/react/form";
import type { ComponentProps } from "react";
import { clsx } from "clsx";
import styles from "./Form.module.css";

export function Form({ className, ...props }: ComponentProps<typeof BaseForm>) {
  return <BaseForm className={clsx(styles.Form, className)} {...props} />;
}
