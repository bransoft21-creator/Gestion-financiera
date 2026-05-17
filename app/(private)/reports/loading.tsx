export default function ReportsLoading() {
  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-2/3 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded-full bg-muted/60" />
      </div>
      {/* Hero card */}
      <div className="rounded-[var(--v2-radius-xl)] border border-border bg-muted/20 p-5 sm:p-6">
        <div className="h-5 w-36 animate-pulse rounded-full bg-muted" />
        <div className="mt-4 h-7 w-1/2 animate-pulse rounded-full bg-muted" />
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded-full bg-muted/60" />
        <div className="mt-5 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-[14px] bg-muted/60" />
          ))}
        </div>
      </div>
      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[var(--v2-radius-lg)] border border-border bg-muted/20 p-3.5 sm:p-[18px]">
            <div className="h-3 w-20 animate-pulse rounded-full bg-muted/60" />
            <div className="mt-2 h-6 w-28 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
      {/* Chart placeholders */}
      <div className="h-[220px] animate-pulse rounded-[var(--v2-radius-xl)] border border-border bg-muted/20 sm:h-[300px]" />
      <div className="h-[180px] animate-pulse rounded-[var(--v2-radius-xl)] border border-border bg-muted/20 sm:h-[240px]" />
    </div>
  );
}
