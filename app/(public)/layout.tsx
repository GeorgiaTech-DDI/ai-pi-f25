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
    <div className="h-screen flex flex-col">
      <header className="w-full flex justify-between p-4 items-center sticky top-0 z-10 bg-background">
        <div className="flex items-center justify-center gap-2">
          <img src="/images/logo.svg" alt="AI PI Logo" className="w-auto h-8" />
          <h2 className="text-lg font-bold">AI PI</h2>
        </div>
        <HeaderButtons className="flex gap-x-1 items-center" />
      </header>
      <main
        data-autoscroll-container
        className="overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] pt-6 flex-1"
      >
        {children}
      </main>
    </div>
  );
}
