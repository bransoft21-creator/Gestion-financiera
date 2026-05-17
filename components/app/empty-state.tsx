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
      <CardContent className="flex min-h-[220px] flex-col items-center justify-center px-6 py-8 text-center sm:min-h-[260px] sm:px-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-border bg-muted/40 text-muted-foreground shadow-sm">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-base font-semibold leading-snug text-foreground">{title}</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
        {actions && actions.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
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
