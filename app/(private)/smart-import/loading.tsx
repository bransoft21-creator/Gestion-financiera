export default function SmartImportLoading() {
  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-2/3 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded-full bg-muted/60" />
      </div>
      {/* Upload area */}
      <div className="min-h-[320px] animate-pulse rounded-[var(--v2-radius-xl)] border-2 border-dashed border-border bg-muted/10" />
    </div>
  );
}
