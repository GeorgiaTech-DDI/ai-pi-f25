"use client";

import { authClient } from "@/lib/auth-client";
import { LogOut } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

export function Logout() {
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <DropdownMenuItem onClick={handleLogout}>
      <div className="flex w-full cursor-pointer items-center gap-x-2">
        <LogOut className="text-destructive size-4" />
        <span>Logout</span>
      </div>
    </DropdownMenuItem>
  );
}
