import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EmptyStateAction = {
  label: string;
  href: string;
  primary?: boolean;
};

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
};

export function EmptyState({ icon: Icon, title, description, actions }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-zinc-300">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        {actions && actions.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={cn(
                  "rounded-2xl px-5 py-2.5 text-sm font-medium transition",
                  action.primary
                    ? "bg-white text-zinc-950 shadow-[0_8px_24px_rgba(255,255,255,0.1)] hover:bg-zinc-100"
                    : "border border-white/10 bg-white/[0.05] text-zinc-200 hover:bg-white/[0.09]",
                )}
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
