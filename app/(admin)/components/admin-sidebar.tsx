"use client";

import Logo from "@/components/logo/logo";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { FileText, LayoutDashboard, ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Documents", href: "/admin/documents", icon: FileText },
  { title: "Query Logs", href: "/admin/logs", icon: ScrollText },
];

export default function AdminSidebar({
  shouldShowQueryLogs,
}: {
  shouldShowQueryLogs: boolean;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="p-4">
        <Logo />
      </SidebarHeader>
      <SidebarContent className="px-3 pt-4">
        <SidebarMenu className="flex flex-col gap-y-1">
          {navItems
            .filter(({ title }) => {
              if (title === "Query Logs") {
                return shouldShowQueryLogs;
              }
              return true;
            })
            .map(({ title, href, icon: Icon }) => (
              <SidebarMenuItem key={title}>
                <SidebarMenuButton
                  tooltip={title}
                  className={cn(pathname == href && "bg-sidebar-accent")}
                >
                  <Link
                    href={href}
                    className="flex h-full w-full items-center gap-x-2"
                  >
                    <Icon />
                    <span>{title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
