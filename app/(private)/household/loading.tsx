export default function HouseholdLoading() {
  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-28 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted/60" />
      </div>
      {/* Household selector */}
      <div className="rounded-[var(--v2-radius-xl)] border border-border bg-muted/20 p-5">
        <div className="flex items-center justify-between">
          <div className="h-5 w-40 animate-pulse rounded-full bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-2xl bg-muted/60" />
        </div>
      </div>
      {/* Member rows */}
      {[1, 2].map((i) => (
        <div key={i} className="rounded-[var(--v2-radius-xl)] border border-border bg-muted/20 p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-muted/60" />
            </div>
            <div className="h-7 w-20 animate-pulse rounded-2xl bg-muted/60" />
          </div>
        </div>
      ))}
      {/* Balance cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-[var(--v2-radius-lg)] border border-border bg-muted/20 p-4">
            <div className="h-3 w-20 animate-pulse rounded-full bg-muted/60" />
            <div className="mt-2 h-7 w-28 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
