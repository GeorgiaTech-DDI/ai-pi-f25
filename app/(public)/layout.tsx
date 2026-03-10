import Button from "components/ui/Button";
import styles from "../../styles/Layout.module.css";
import Link from "next/link";

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
        <div>
          <Button nativeButton={false} render={<Link href="/admin/login" />}>
            Admin
          </Button>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
