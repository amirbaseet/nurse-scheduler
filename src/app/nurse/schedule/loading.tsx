export default function NurseScheduleLoading() {
  return (
    <div className="space-y-4 p-4">
      {/* Week navigator */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          <div className="h-8 w-28 animate-pulse rounded bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Day cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-xl border p-4">
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted/60" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted/40" />
        </div>
      ))}
    </div>
  );
}
