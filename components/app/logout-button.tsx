"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  compact?: boolean;
  className?: string;
};

export function LogoutButton({ compact = false, className }: LogoutButtonProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant={compact ? "ghost" : "secondary"}
      size={compact ? "icon" : "sm"}
      className={cn(
        compact && "h-9 w-9 rounded-full border-0 bg-transparent text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        !compact && "rounded-full bg-secondary/70 px-3 text-muted-foreground hover:text-foreground",
        className,
      )}
      onClick={handleLogout}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {compact ? null : "Cerrar sesión"}
    </Button>
  );
}
