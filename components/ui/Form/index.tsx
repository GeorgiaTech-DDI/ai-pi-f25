import { Form as BaseForm } from "@base-ui/react/form";
import type { ComponentProps } from "react";
import { clsx } from "clsx";

export function Form({ className, ...props }: ComponentProps<typeof BaseForm>) {
  return <BaseForm className={clsx(className)} {...props} />;
}
