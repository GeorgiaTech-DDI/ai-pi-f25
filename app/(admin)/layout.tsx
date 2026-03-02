/**
 * Admin route group layout.
 *
 * Route protection is handled at the edge by middleware.ts.
 * This layout can be a simple passthrough — if the user reaches here they
 * are already authenticated.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
