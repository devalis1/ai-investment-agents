export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-full max-w-md rounded bg-muted animate-pulse" />
      </div>
      <div className="h-36 rounded-xl border border-border bg-card animate-pulse" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-xl border border-border bg-card animate-pulse" />
        <div className="h-72 rounded-xl border border-border bg-card animate-pulse" />
      </div>
    </div>
  );
}
