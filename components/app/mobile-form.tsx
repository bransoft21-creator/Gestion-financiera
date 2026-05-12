"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

type AppFormPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  desktopAlwaysOpen?: boolean;
};

export function AppFormPanel({
  isOpen,
  onClose,
  children,
  className,
  desktopAlwaysOpen = true,
}: AppFormPanelProps) {
  const isMounted = useClientMounted();
  const isXl = useIsXl();
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (isOpen) {
      mobilePanelRef.current
        ?.querySelector(".app-form-content-scroll")
        ?.scrollTo({ top: 0, left: 0 });
    }
  }, [isOpen]);

  // Render children ONLY in the desktop card on xl screens, and ONLY in the
  // mobile portal on smaller screens. This prevents react-hook-form from
  // registering the same field twice, which caused refs to be hijacked by the
  // hidden panel, making form values invisible to RHF on submit.
  const desktopPanel = (
    <Card className={appFormDesktopPanelClass(isOpen, className, { desktopAlwaysOpen })}>
      {isXl ? children : null}
    </Card>
  );

  const mobilePanel =
    isMounted && isOpen && !isXl
      ? createPortal(
          <div ref={mobilePanelRef}>
            <MobileFormOverlay isOpen={isOpen} onClose={onClose} />
            <Card
              aria-modal
              className={appFormMobilePanelClass(className)}
              role="dialog"
            >
              {children}
            </Card>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {desktopPanel}
      {mobilePanel}
    </>
  );
}

function useClientMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

function useIsXl(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia("(min-width: 1280px)");
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    () => window.matchMedia("(min-width: 1280px)").matches,
    () => false,
  );
}

function useLockBodyScroll(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(max-width: 1279px)");
    if (!media.matches) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [isOpen]);
}

function MobileFormOverlay({
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
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 xl:hidden"
      onClick={onClose}
    />
  );
}

function appFormDesktopPanelClass(
  isOpen: boolean,
  className?: string,
  options: { desktopAlwaysOpen?: boolean } = {},
) {
  const { desktopAlwaysOpen = true } = options;

  return cn(
    "hidden xl:h-auto xl:max-h-[calc(100dvh-8rem)] xl:min-h-0 xl:overflow-hidden",
    isOpen || desktopAlwaysOpen ? "xl:flex xl:flex-col" : undefined,
    className,
  );
}

function appFormMobilePanelClass(className?: string) {
  return cn(
    "fixed inset-0 z-[100] flex h-dvh max-h-dvh w-screen max-w-[100vw] touch-pan-y flex-col overflow-hidden overflow-x-hidden overscroll-none rounded-none border-x-0 border-y-0 bg-zinc-950/96 pt-[env(safe-area-inset-top)] shadow-2xl animate-slide-up",
    className,
  );
}

export function appFormContentClass(isOpen: boolean, className?: string) {
  return cn(
    "app-form-content-scroll xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overflow-x-hidden xl:overscroll-contain xl:pb-5",
    isOpen
      ? "min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-y-contain pb-[calc(4rem+env(safe-area-inset-bottom))] pt-0 xl:pb-5"
      : undefined,
    className,
  );
}

export function appFormHeaderClass(className?: string) {
  return cn(
    "sticky top-0 z-20 shrink-0 border-b border-white/10 bg-zinc-950/92 backdrop-blur-xl xl:static xl:border-b-0 xl:bg-transparent xl:backdrop-blur-none",
    className,
  );
}

export function appFormActionsClass(className?: string) {
  return cn(
    "mt-6 grid scroll-mt-6 gap-2 pb-3 sm:grid-cols-2 xl:mt-0 xl:pb-0 2xl:grid-cols-2",
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
      className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-4 z-30 h-14 w-14 rounded-full bg-teal-300 text-zinc-950 shadow-[0_18px_55px_rgba(45,212,191,0.28)] transition duration-200 hover:bg-teal-200 hover:shadow-[0_22px_60px_rgba(45,212,191,0.36)] active:scale-90 xl:hidden"
      onClick={onClick}
      aria-label={label}
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
    </Button>
  );
}
