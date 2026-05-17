export default function TransactionsLoading() {
  return (
    <div className="space-y-4">
      {/* Filter bar skeleton */}
      <div className="rounded-[var(--v2-radius-xl)] border border-border bg-muted/20 p-4">
        <div className="flex gap-2">
          <div className="h-8 flex-1 animate-pulse rounded-xl bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-xl bg-muted/60" />
        </div>
      </div>
      {/* Transaction groups */}
      {[1, 2, 3].map((group) => (
        <div key={group} className="space-y-1">
          <div className="h-3 w-28 animate-pulse rounded-full bg-muted/60 px-1" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-muted/10 px-4 py-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 animate-pulse rounded-full bg-muted" />
                <div className="h-2.5 w-24 animate-pulse rounded-full bg-muted/60" />
              </div>
              <div className="h-4 w-20 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
