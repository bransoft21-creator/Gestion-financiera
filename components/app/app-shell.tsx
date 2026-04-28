import { BottomNav } from "./bottom-nav";
import { GlobalProcessingIndicator } from "./global-processing-indicator";
import { LogoutButton } from "./logout-button";
import { MobileHeader } from "./mobile-header";
import { NotificationsButton } from "./notifications-button";
import { PageTransition } from "./page-transition";
import { PrivacyToggle } from "./privacy-toggle";
import { Sidebar } from "./sidebar";

type AppShellProps = {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <GlobalProcessingIndicator />
      <MobileHeader />
      <div className="fixed right-5 top-4 z-30 hidden items-center gap-2 lg:flex">
        <PrivacyToggle />
        <NotificationsButton />
        <LogoutButton />
      </div>
      <div className="lg:flex">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <PageTransition>
            <div className="mx-auto w-full max-w-[1200px] px-4 pb-[88px] pt-5 lg:px-8 lg:py-7">
              {children}
            </div>
          </PageTransition>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
