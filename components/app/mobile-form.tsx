import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export function MobileFormOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 xl:hidden"
      onClick={onClose}
    />
  );
}

export function mobileFormCardClass(
  isOpen: boolean,
  className?: string,
  options: { desktopAlwaysOpen?: boolean } = {},
) {
  const { desktopAlwaysOpen = true } = options;

  return cn(
    isOpen
      ? "fixed inset-0 z-50 flex h-dvh max-h-dvh flex-col overflow-hidden rounded-none border-x-0 border-y-0 animate-slide-up sm:inset-x-4 sm:bottom-4 sm:top-auto sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border xl:static xl:h-auto xl:max-h-none xl:overflow-visible xl:rounded-lg xl:border"
      : "hidden",
    desktopAlwaysOpen ? "xl:flex xl:flex-col" : undefined,
    className,
  );
}

export function mobileFormContentClass(isOpen: boolean, className?: string) {
  return cn(
    isOpen
      ? "flex-1 overflow-y-auto pb-0 pt-0 xl:overflow-visible xl:pb-5"
      : undefined,
    className,
  );
}

export function mobileFormActionsClass(className?: string) {
  return cn(
    "sticky bottom-0 -mx-5 mt-auto grid gap-2 border-t border-border bg-card/95 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] backdrop-blur sm:grid-cols-2 xl:static xl:mx-0 xl:mt-0 xl:border-0 xl:bg-transparent xl:p-0 xl:backdrop-blur-none 2xl:grid-cols-2",
    className,
  );
}

export function MobileCreateFab({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon"
      className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-4 z-30 h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 xl:hidden"
      onClick={onClick}
      aria-label={label}
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
    </Button>
  );
}
