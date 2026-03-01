export default function ManagerLoading() {
  return (
    <div className="space-y-6 p-2">
      {/* Page title skeleton */}
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="space-y-3">
        <div className="h-10 animate-pulse rounded bg-muted" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
