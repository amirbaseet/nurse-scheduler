export default function NurseLoading() {
  return (
    <div className="space-y-4 p-4">
      {/* Page title */}
      <div className="h-7 w-36 animate-pulse rounded bg-muted" />

      {/* Cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
      ))}

      {/* List items */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
