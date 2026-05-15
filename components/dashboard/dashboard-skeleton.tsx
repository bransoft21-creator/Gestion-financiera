export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="v2-card-raised rounded-[var(--v2-radius-xl)] p-5 sm:p-7">
        <div className="mb-4 flex gap-2">
          <div className="h-6 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
        <div className="h-8 w-3/5 animate-pulse rounded-full bg-white/10" />
        <div className="mt-3 h-4 w-4/5 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mt-6 h-14 w-44 animate-pulse rounded-full bg-white/10" />
        <div className="mt-5 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 w-24 animate-pulse rounded-full bg-white/[0.06]" />
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-[var(--v2-radius-xl)] border border-white/10 bg-white/[0.025] p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-2xl bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-36 animate-pulse rounded-full bg-white/10" />
            <div className="h-3 w-52 animate-pulse rounded-full bg-white/[0.06]" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded-2xl bg-white/10" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="v2-card rounded-[var(--v2-radius-lg)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2.5">
                <div className="h-2.5 w-14 animate-pulse rounded-full bg-white/10" />
                <div className="h-7 w-20 animate-pulse rounded-full bg-white/10" />
                <div className="h-2 w-28 animate-pulse rounded-full bg-white/[0.06]" />
              </div>
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-white/10" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="v2-card animate-pulse rounded-[var(--v2-radius-lg)] h-52" />
        <div className="v2-card animate-pulse rounded-[var(--v2-radius-lg)] h-52" />
      </div>
    </div>
  );
}
