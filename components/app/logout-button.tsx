"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LogoutButtonProps = {
  compact?: boolean;
};

export function LogoutButton({ compact = false }: LogoutButtonProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" size={compact ? "icon" : "sm"} onClick={handleLogout} aria-label="Cerrar sesión">
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {compact ? null : "Cerrar sesión"}
    </Button>
  );
}
