import { cn } from "@/lib/utils";

type V2PageShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function V2PageShell({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: V2PageShellProps) {
  return (
    <div className={cn("space-y-5 sm:space-y-6", className)}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:mb-2">
              {eyebrow}
            </p>
          )}
          <h1 className="text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-zinc-400 sm:mt-2 sm:text-sm">
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
