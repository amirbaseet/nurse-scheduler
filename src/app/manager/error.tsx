"use client";

import { useEffect } from "react";

export default function ManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Manager error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10">
        <span className="text-2xl">!</span>
      </div>
      <h2 className="text-lg font-semibold">שגיאה בטעינת הדף</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        לא ניתן לטעון את הדף. ייתכן שהבעיה זמנית.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        נסה שוב
      </button>
    </div>
  );
}
