import Header from "@/components/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { auth } from "@/lib/auth";
import { LogOut, PanelLeft } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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

  // if (!session) {
  //   redirect("/");
  // }

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

  return (
    <div className="flex h-full flex-col">
      <Header
        rightContent={
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar>
                <AvatarImage src={user?.image || ""} />
                <AvatarFallback>{user?.initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <LogOut className="text-destructive size-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        leftItem={
          <Button size="icon" variant="ghost">
            <PanelLeft className="size-4" />
          </Button>
        }
      />
      <main
        data-autoscroll-container
        className="flex-1 overflow-x-hidden overflow-y-auto pt-6 [scrollbar-gutter:stable]"
      >
        {children}
      </main>
    </div>
  );
}
