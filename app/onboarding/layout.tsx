import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bienvenido — Meridian",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 antialiased">
      {children}
    </div>
  );
}
