"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogoutDialog } from "./logout-dialog";

type LogoutButtonProps = {
  compact?: boolean;
  className?: string;
};

export function LogoutButton({ compact = false, className }: LogoutButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant={compact ? "ghost" : "secondary"}
        size={compact ? "icon" : "sm"}
        className={cn(
          compact && "h-9 w-9 rounded-full border-0 bg-transparent text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
          !compact && "rounded-full bg-secondary/70 px-3 text-muted-foreground hover:text-foreground",
          className,
        )}
        onClick={() => setDialogOpen(true)}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {compact ? null : "Cerrar sesión"}
      </Button>
      <LogoutDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
