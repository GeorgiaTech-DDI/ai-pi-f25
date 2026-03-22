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
    <div className="flex h-full flex-col">
      <header
        className="bg-background sticky top-0 z-10 flex w-full items-center justify-between p-4"
        data-header
      >
        <div className="flex items-center justify-center gap-2">
          <img src="/images/logo.svg" alt="AI PI Logo" className="h-8 w-auto" />
          <h2 className="text-lg font-bold">AI PI</h2>
        </div>
        <HeaderButtons className="flex items-center gap-x-1" />
      </header>
      <main
        data-autoscroll-container
        className="flex-1 overflow-x-hidden overflow-y-auto pt-6 [scrollbar-gutter:stable]"
      >
        {children}
      </main>
    </div>
  );
}
