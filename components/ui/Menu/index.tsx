import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ComponentProps } from "react";
import styles from "./index.module.css";

// ── Root ─────────────────────────────────────────────────────────────────────

function MenuRoot(props: ComponentProps<typeof BaseMenu.Root>) {
  return <BaseMenu.Root {...props} />;
}

// ── Trigger ──────────────────────────────────────────────────────────────────
// Renders a plain BaseMenu.Trigger. Pass `render` to swap the element, or use
// as-is for a plain button with the trigger wired up automatically.

function MenuTrigger(props: ComponentProps<typeof BaseMenu.Trigger>) {
  return <BaseMenu.Trigger {...props} />;
}

// ── Portal ───────────────────────────────────────────────────────────────────

function MenuPortal(props: ComponentProps<typeof BaseMenu.Portal>) {
  return <BaseMenu.Portal {...props} />;
}

// ── Positioner ────────────────────────────────────────────────────────────────

function MenuPositioner({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof BaseMenu.Positioner>) {
  return (
    <BaseMenu.Positioner
      className={[styles.Positioner, className].filter(Boolean).join(" ")}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

// ── Popup ─────────────────────────────────────────────────────────────────────

function MenuPopup({
  className,
  ...props
}: ComponentProps<typeof BaseMenu.Popup>) {
  return (
    <BaseMenu.Popup
      className={[styles.Popup, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

// ── Arrow ─────────────────────────────────────────────────────────────────────

function MenuArrow({
  className,
  ...props
}: ComponentProps<typeof BaseMenu.Arrow>) {
  return (
    <BaseMenu.Arrow
      className={[styles.Arrow, className].filter(Boolean).join(" ")}
      {...props}
    >
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
    </BaseMenu.Arrow>
  );
}

// ── Item ──────────────────────────────────────────────────────────────────────

function MenuItem({
  className,
  ...props
}: ComponentProps<typeof BaseMenu.Item>) {
  return (
    <BaseMenu.Item
      className={[styles.Item, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

// ── Separator ─────────────────────────────────────────────────────────────────

function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof BaseMenu.Separator>) {
  return (
    <BaseMenu.Separator
      className={[styles.Separator, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

// ── Group ─────────────────────────────────────────────────────────────────────

function MenuGroup(props: ComponentProps<typeof BaseMenu.Group>) {
  return <BaseMenu.Group {...props} />;
}

function MenuGroupLabel(props: ComponentProps<typeof BaseMenu.GroupLabel>) {
  return <BaseMenu.GroupLabel {...props} />;
}

// ── Submenu trigger ───────────────────────────────────────────────────────────

function MenuSubmenuTrigger({
  className,
  ...props
}: ComponentProps<typeof BaseMenu.SubmenuTrigger>) {
  return (
    <BaseMenu.SubmenuTrigger
      className={[styles.Item, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

// ── Convenience compound wrapper ──────────────────────────────────────────────
// Usage:
//   <Menu trigger={<button>Open</button>}>
//     <Menu.Item onClick={...}>Action</Menu.Item>
//     <Menu.Separator />
//     <Menu.Item>Another</Menu.Item>
//   </Menu>

interface MenuProps extends ComponentProps<typeof BaseMenu.Root> {
  /** The element that opens the menu. Receives MenuTrigger props automatically. */
  trigger: React.ReactNode;
  children: React.ReactNode;
}

export default function Menu({ trigger, children, ...props }: MenuProps) {
  return (
    <MenuRoot {...props}>
      <MenuTrigger render={trigger as React.ReactElement} />
      <MenuPortal>
        <MenuPositioner>
          <MenuPopup>
            <MenuArrow />
            {children}
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </MenuRoot>
  );
}

// Named parts — shadcn style
Menu.Root = MenuRoot;
Menu.Trigger = MenuTrigger;
Menu.Portal = MenuPortal;
Menu.Positioner = MenuPositioner;
Menu.Popup = MenuPopup;
Menu.Arrow = MenuArrow;
Menu.Item = MenuItem;
Menu.Separator = MenuSeparator;
Menu.Group = MenuGroup;
Menu.GroupLabel = MenuGroupLabel;
Menu.SubmenuTrigger = MenuSubmenuTrigger;
