import { cn } from "@/lib/utils";

type V2PageShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
};

export function V2PageShell({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  compact = false,
}: V2PageShellProps) {
  return (
    <div className={cn(compact ? "space-y-4 sm:space-y-5" : "space-y-5 sm:space-y-6", className)}>
      <header className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between",
        compact ? "gap-2.5 sm:gap-3" : "gap-3 sm:gap-4",
      )}>
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:mb-2">
              {eyebrow}
            </p>
          )}
          <h1 className={cn(
            "text-balance font-semibold leading-tight tracking-normal text-foreground",
            compact ? "text-[1.55rem] sm:text-3xl lg:text-[2rem]" : "text-[1.75rem] sm:text-3xl lg:text-4xl",
          )}>
            {title}
          </h1>
          {description && (
            <p className={cn(
              "max-w-2xl text-[13px] text-muted-foreground sm:text-sm",
              compact ? "mt-1 leading-5 sm:mt-1.5" : "mt-1.5 leading-6 sm:mt-2",
            )}>
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </div>
  );
}
