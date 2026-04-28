import { Toaster } from "sonner";
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

export function AppShell({ children, userName, userEmail }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <GlobalProcessingIndicator />
      <MobileHeader userName={userName} />
      <div className="fixed right-5 top-4 z-30 hidden items-center gap-1 rounded-full border border-border/70 bg-card/80 p-1 shadow-lg shadow-black/20 backdrop-blur lg:flex">
        <PrivacyToggle compact />
        <NotificationsButton compact />
        <LogoutButton compact />
      </div>
      <div className="lg:flex">
        <Sidebar userName={userName} userEmail={userEmail} />
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <PageTransition>
            <div className="mx-auto w-full max-w-[1200px] px-4 pb-[88px] pt-5 lg:px-8 lg:py-7">
              {children}
            </div>
          </PageTransition>
        </main>
      </div>
      <BottomNav />
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" },
        }}
        richColors
      />
    </div>
  );
}
