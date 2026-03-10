import { Button } from "components/ui/Button";
import styles from "../../styles/Layout.module.css";
import { EllipsisVertical, MessageSquareCheck } from "lucide-react";
import Menu from "components/ui/Menu";

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
          <Button variant="ghost">
            <MessageSquareCheck />
          </Button>
          <Menu
            trigger={
              <Button variant="ghost">
                <EllipsisVertical />
              </Button>
            }
          >
            <Menu.Item>Export Chat</Menu.Item>
            <Menu.Item>Clear Chat</Menu.Item>
          </Menu>
          <Button href="/admin/login">Admin</Button>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
