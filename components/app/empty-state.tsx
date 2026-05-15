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
      <CardContent className="flex min-h-[300px] flex-col items-center justify-center px-8 py-10 text-center sm:min-h-[320px]">
        <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/[0.10] bg-white/[0.05] text-zinc-400 shadow-[0_8px_28px_rgba(0,0,0,0.2)]">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-base font-semibold leading-snug text-white">{title}</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">{description}</p>
        {actions && actions.length > 0 && (
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={cn(
                  "rounded-2xl px-5 py-2.5 text-sm font-semibold transition duration-150",
                  action.primary
                    ? "bg-foreground text-background shadow-[var(--btn-default-shadow)] hover:opacity-90"
                    : "border border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
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
