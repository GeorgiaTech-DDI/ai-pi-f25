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
      <header className="w-full flex justify-between p-4 items-center">
        <div className="flex items-center justify-center gap-2">
          <img src="/images/logo.svg" alt="AI PI Logo" className="w-auto h-8" />
          <h2 className="text-lg font-bold">AI PI</h2>
        </div>
        <HeaderButtons className="flex gap-x-1 items-center" />
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
