import { Button } from "components/ui/Button";
import styles from "./layout.module.css";
import { EllipsisVertical, MessageSquareCheck } from "lucide-react";
import { Menu } from "components/ui/Menu";

/**
 * Public route group layout — no auth required.
 * Thin passthrough; global providers are applied by the root app/layout.tsx.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <img
            src="/images/logo.svg"
            alt="AI PI Logo"
            className={styles.logo}
          />
          <h2 className={styles.title}>AI PI</h2>
        </div>
        <div className={styles.buttons}>
          <Button
            variant="icon"
            ghost
            tooltip="Give feedback"
            aria-label="Give feedback"
          >
            <MessageSquareCheck />
          </Button>
          <Menu
            trigger={
              <Button variant="icon" ghost aria-label="More options">
                <EllipsisVertical />
              </Button>
            }
          >
            <Menu.Item>Save Chat</Menu.Item>
            <Menu.Item style={{ color: "red" }}>Restart</Menu.Item>
          </Menu>
          <Button href="/admin/login">Admin Log In</Button>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
