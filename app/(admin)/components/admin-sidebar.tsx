"use client";

import Logo from "@/components/logo/logo";
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

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="p-4">
        <Logo />
      </SidebarHeader>
      <SidebarContent className="px-3">
        <SidebarMenu className="flex flex-col gap-y-1">
          {navItems.map(({ title, href, icon: Icon }) => (
            <SidebarMenuItem key={title}>
              <SidebarMenuButton
                tooltip={title}
                className={cn(pathname == href && "bg-sidebar-accent")}
              >
                <Link href={href} className="flex items-center gap-x-2 w-full">
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
