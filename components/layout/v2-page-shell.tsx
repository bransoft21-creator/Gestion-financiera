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
    <div className={cn("space-y-6", className)}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">{eyebrow}</p>}
          <h1 className="text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </div>
  );
}
