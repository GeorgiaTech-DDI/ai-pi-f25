import Header from "@/components/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { headers } from "next/headers";
import AdminSidebar from "../components/admin-sidebar";
import { getPostHogClient } from "@/lib/posthog-server";
import { Logout } from "./documents/components/logout-button";

/**
 * Admin route group layout.
 *
 * Route protection is handled at the edge by middleware.ts.
 * This layout can be a simple passthrough — if the user reaches here they
 * are already authenticated.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // TODO: export name getting into a utility
  const name = session?.user.name;
  const firstName = name?.split(",")[1]?.trim();
  const lastName = name?.split(",")[0]?.trim();

  const user = session?.user
    ? {
        email: session.user.email,
        displayName: name || session.user.email,
        initials: firstName && lastName ? `${firstName[0]}${lastName[0]}` : "",
        image: session.user.image,
      }
    : null;

  const posthogClient = getPostHogClient();
  const isNewSidebarEnabled = await posthogClient.isFeatureEnabled(
    "new-sidebar",
    user?.email ?? ""
  );

  const shouldShowQueryLogs = await posthogClient.isFeatureEnabled(
    "show-query-logs-sidebar",
    user?.email ?? ""
  );

  return (
    <SidebarProvider defaultOpen={false}>
      <AdminSidebar shouldShowQueryLogs={!!shouldShowQueryLogs} />
      <div className="flex min-h-svh w-full flex-col overflow-hidden">
        <Header
          rightContent={
            user && (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Avatar>
                    <AvatarImage src={user.image || ""} />
                    <AvatarFallback>{user.initials}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Logout />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }
          leftItem={
            user && isNewSidebarEnabled ? (
              <SidebarTrigger />
            ) : (
              <Image
                src="/images/logo.svg"
                alt="AI PI Logo"
                className="h-8 w-auto"
                width={32}
                height={32}
              />
            )
          }
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 pt-4">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
