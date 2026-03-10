import { Button as BaseButton } from "@base-ui/react";
import type { ComponentProps } from "react";
import { clsx } from "clsx";
import styles from "./index.module.css";

export default function Button({
  className,
  ...props
}: ComponentProps<typeof BaseButton>) {
  return <BaseButton className={clsx(styles.Button, className)} {...props} />;
}
