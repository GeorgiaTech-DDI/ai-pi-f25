"use client";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";
import { clsx } from "clsx";
import styles from "./Dialog.module.css";

// ── Root ──────────────────────────────────────────────────────────────────────

function DialogRoot(props: ComponentProps<typeof BaseDialog.Root>) {
  return <BaseDialog.Root {...props} />;
}

// ── Trigger ───────────────────────────────────────────────────────────────────

function DialogTrigger(props: ComponentProps<typeof BaseDialog.Trigger>) {
  return <BaseDialog.Trigger {...props} />;
}

// ── Portal ────────────────────────────────────────────────────────────────────

function DialogPortal(props: ComponentProps<typeof BaseDialog.Portal>) {
  return <BaseDialog.Portal {...props} />;
}

// ── Backdrop ──────────────────────────────────────────────────────────────────

function DialogBackdrop({
  className,
  ...props
}: ComponentProps<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      className={clsx(styles.Backdrop, className)}
      {...props}
    />
  );
}

// ── Popup ─────────────────────────────────────────────────────────────────────

function DialogPopup({
  className,
  ...props
}: ComponentProps<typeof BaseDialog.Popup>) {
  return (
    <BaseDialog.Popup className={clsx(styles.Popup, className)} {...props} />
  );
}

// ── Title ─────────────────────────────────────────────────────────────────────

function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title className={clsx(styles.Title, className)} {...props} />
  );
}

// ── Description ───────────────────────────────────────────────────────────────

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      className={clsx(styles.Description, className)}
      {...props}
    />
  );
}

// ── Close ─────────────────────────────────────────────────────────────────────

function DialogClose(props: ComponentProps<typeof BaseDialog.Close>) {
  return <BaseDialog.Close {...props} />;
}

// ── Actions ───────────────────────────────────────────────────────────────────
// Convenience layout wrapper for footer buttons.

function DialogActions({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx(styles.Actions, className)} {...props} />;
}

// ── ActionsLeft ───────────────────────────────────────────────────────────────
// Push content to the left side of the Actions row.

function DialogActionsLeft({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx(styles.ActionsLeft, className)} {...props} />;
}

// ── Convenience compound wrapper ──────────────────────────────────────────────
// Usage:
//   <Dialog trigger={<Button>Open</Button>} title="My Dialog">
//     <p>Content here</p>
//   </Dialog>
//
// Or fully controlled:
//   <Dialog.Root open={open} onOpenChange={setOpen}>
//     <Dialog.Trigger>...</Dialog.Trigger>
//     <Dialog.Portal>
//       <Dialog.Backdrop />
//       <Dialog.Popup>
//         <Dialog.Title>...</Dialog.Title>
//         ...
//       </Dialog.Popup>
//     </Dialog.Portal>
//   </Dialog.Root>

interface DialogProps extends ComponentProps<typeof BaseDialog.Root> {
  /** Element that opens the dialog when clicked. */
  trigger?: React.ReactElement;
  /** Rendered as Dialog.Title if provided. */
  title?: React.ReactNode;
  /** Rendered as Dialog.Description if provided. */
  description?: React.ReactNode;
  children?: React.ReactNode;
}

export function Dialog({
  trigger,
  title,
  description,
  children,
  ...props
}: DialogProps) {
  return (
    <DialogRoot {...props}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup>
          {title && <DialogTitle>{title}</DialogTitle>}
          {description && <DialogDescription>{description}</DialogDescription>}
          {children}
        </DialogPopup>
      </DialogPortal>
    </DialogRoot>
  );
}

// Named parts — shadcn style
Dialog.Root = DialogRoot;
Dialog.Trigger = DialogTrigger;
Dialog.Portal = DialogPortal;
Dialog.Backdrop = DialogBackdrop;
Dialog.Popup = DialogPopup;
Dialog.Title = DialogTitle;
Dialog.Description = DialogDescription;
Dialog.Close = DialogClose;
Dialog.Actions = DialogActions;
Dialog.ActionsLeft = DialogActionsLeft;
