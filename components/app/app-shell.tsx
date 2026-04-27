import { BottomNav } from "./bottom-nav";
import { MobileHeader } from "./mobile-header";
import { PageTransition } from "./page-transition";
import { Sidebar } from "./sidebar";

type AppShellProps = {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <MobileHeader />
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
