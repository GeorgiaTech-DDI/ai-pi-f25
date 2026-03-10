import Button from "components/ui/Button";
import styles from "../../styles/Layout.module.css";
import Link from "next/link";
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
          <Button>
            <MessageSquareCheck />
          </Button>
          <Menu
            trigger={
              <Button>
                <EllipsisVertical />
              </Button>
            }
          >
            <Menu.Item>Item 1</Menu.Item>
            <Menu.Item>Item 2</Menu.Item>
            <Menu.Item>Item 3</Menu.Item>
          </Menu>
          <Button nativeButton={false} render={<Link href="/admin/login" />}>
            Admin
          </Button>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
