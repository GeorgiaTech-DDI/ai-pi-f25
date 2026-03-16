import styles from "./layout.module.css";
import HeaderButtons from "./components/header-buttons/header-buttons";

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
        <HeaderButtons className={styles.buttons} />
      </header>
      <main className={styles.main}>{children}</main>
    </>
  );
}
