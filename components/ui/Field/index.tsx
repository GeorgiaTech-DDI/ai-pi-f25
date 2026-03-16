import { Field as BaseField } from "@base-ui/react/field";
import type { ComponentProps } from "react";
import { clsx } from "clsx";
import styles from "./Field.module.css";

// ── Root ──────────────────────────────────────────────────────────────────────

function FieldRoot({
  className,
  ...props
}: ComponentProps<typeof BaseField.Root>) {
  return <BaseField.Root className={clsx(styles.Root, className)} {...props} />;
}

// ── Label ─────────────────────────────────────────────────────────────────────

function FieldLabel({
  className,
  ...props
}: ComponentProps<typeof BaseField.Label>) {
  return (
    <BaseField.Label className={clsx(styles.Label, className)} {...props} />
  );
}

// ── Control ───────────────────────────────────────────────────────────────────

function FieldControl({
  className,
  ...props
}: ComponentProps<typeof BaseField.Control>) {
  return (
    <BaseField.Control className={clsx(styles.Control, className)} {...props} />
  );
}

// ── Description ───────────────────────────────────────────────────────────────

function FieldDescription({
  className,
  ...props
}: ComponentProps<typeof BaseField.Description>) {
  return (
    <BaseField.Description
      className={clsx(styles.Description, className)}
      {...props}
    />
  );
}

// ── Item ──────────────────────────────────────────────────────────────────────
// Groups individual items in a checkbox/radio group with a label and description.

function FieldItem({
  className,
  ...props
}: ComponentProps<typeof BaseField.Item>) {
  return <BaseField.Item className={clsx(styles.Item, className)} {...props} />;
}

// ── Error ─────────────────────────────────────────────────────────────────────

function FieldError({
  className,
  ...props
}: ComponentProps<typeof BaseField.Error>) {
  return (
    <BaseField.Error className={clsx(styles.Error, className)} {...props} />
  );
}

// ── Validity ──────────────────────────────────────────────────────────────────
// Render-prop primitive — no className, children must be a function:
// <Field.Validity>{(validity) => <div>...</div>}</Field.Validity>

function FieldValidity(props: ComponentProps<typeof BaseField.Validity>) {
  return <BaseField.Validity {...props} />;
}

// ── Convenience compound wrapper ──────────────────────────────────────────────
// Usage:
//   <Field name="email">
//     <Field.Label>Email</Field.Label>
//     <Field.Control type="email" required />
//     <Field.Description>We'll never share your email.</Field.Description>
//     <Field.Error />
//   </Field>

interface FieldProps extends ComponentProps<typeof BaseField.Root> {
  children: React.ReactNode;
}

export function Field({ children, ...props }: FieldProps) {
  return <FieldRoot {...props}>{children}</FieldRoot>;
}

// Named parts — shadcn style
Field.Root = FieldRoot;
Field.Label = FieldLabel;
Field.Control = FieldControl;
Field.Description = FieldDescription;
Field.Item = FieldItem;
Field.Error = FieldError;
Field.Validity = FieldValidity;
