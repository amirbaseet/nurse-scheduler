export default function ScheduleLoading() {
  return (
    <div className="space-y-4 p-2">
      {/* Header with week navigator */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-9 w-9 animate-pulse rounded bg-muted" />
          <div className="h-9 w-32 animate-pulse rounded bg-muted" />
          <div className="h-9 w-9 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Schedule grid skeleton */}
      <div className="overflow-hidden rounded-xl border">
        {/* Header row */}
        <div className="grid grid-cols-7 gap-px bg-muted">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse bg-muted" />
          ))}
        </div>
        {/* Body rows (nurses) */}
        {Array.from({ length: 8 }).map((_, row) => (
          <div key={row} className="grid grid-cols-7 gap-px">
            {Array.from({ length: 7 }).map((_, col) => (
              <div
                key={col}
                className="h-16 animate-pulse bg-muted/40"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
