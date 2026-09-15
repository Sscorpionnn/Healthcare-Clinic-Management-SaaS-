"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    router.refresh();
    router.push("/login");
  }

  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2"
      onClick={handleLogout}
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
