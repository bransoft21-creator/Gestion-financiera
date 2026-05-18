import { Toaster } from "sonner";
import { BottomNav } from "./bottom-nav";
import { GlobalProcessingIndicator } from "./global-processing-indicator";
import { LogoutButton } from "./logout-button";
import { MobileHeader } from "./mobile-header";
import { NotificationsButton } from "./notifications-button";
import { OnlineStatusBanner } from "./online-status-banner";
import { PageTransition } from "./page-transition";
import { PreferencesProvider } from "./preferences-provider";
import { PrivacyToggle } from "./privacy-toggle";
import { Sidebar } from "./sidebar";
import { TelemetryProvider } from "./telemetry-provider";
import { UserProvider } from "./user-context";
import { TutorialProvider, TutorialSpotlight } from "./tutorial";
import type { NavigationAwareness } from "@/lib/navigation-awareness";

type AppShellProps = {
  children: React.ReactNode;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  awareness?: NavigationAwareness;
};

export function AppShell({ children, userId, userName, userEmail, awareness }: AppShellProps) {
  return (
    <UserProvider userName={userName ?? null}>
      <PreferencesProvider>
      <TutorialProvider>
        <div className="v2-shell min-h-screen bg-background">
          <TelemetryProvider userId={userId} />
          <GlobalProcessingIndicator />
          <OnlineStatusBanner />
          <MobileHeader userName={userName} />
          <div className="fixed right-5 top-4 z-30 hidden items-center gap-1 rounded-full border border-border bg-background/80 p-1 shadow-lg shadow-black/20 backdrop-blur-xl lg:flex">
            <span data-tutorial="privacy-toggle-desktop">
              <PrivacyToggle compact />
            </span>
            <span data-tutorial="notifications-desktop">
              <NotificationsButton compact panelClassName="right-[-44px]" />
            </span>
            <LogoutButton compact />
          </div>
          <div className="lg:flex">
            <Sidebar userName={userName} userEmail={userEmail} awareness={awareness} />
            <main className="min-w-0 flex-1 overflow-x-hidden">
              <PageTransition>
                <div className="mx-auto w-full max-w-[1200px] px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-5 lg:px-8 lg:py-7">
                  {children}
                </div>
              </PageTransition>
            </main>
          </div>
          <BottomNav awareness={awareness} />
          <TutorialSpotlight />
          <Toaster
            className="meridian-toaster"
            position="top-center"
            offset={{ top: "calc(env(safe-area-inset-top) + 88px)", left: 16, right: 16 }}
            mobileOffset={{
              top: "max(calc(env(safe-area-inset-top) + 76px), 24px)",
              left: "max(env(safe-area-inset-left), 16px)",
              right: "max(env(safe-area-inset-right), 16px)",
            }}
            visibleToasts={3}
            gap={10}
            toastOptions={{
              className: "meridian-toast",
              style: {
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
              },
            }}
            richColors
          />
        </div>
      </TutorialProvider>
      </PreferencesProvider>
    </UserProvider>
  );
}
