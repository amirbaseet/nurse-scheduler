"use client";

import { useEffect } from "react";

export default function NurseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Nurse error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10">
        <span className="text-2xl">!</span>
      </div>
      <h2 className="text-lg font-semibold">שגיאה בטעינת הדף</h2>
      <p className="text-sm text-muted-foreground">
        משהו השתבש. נסי שוב.
      </p>
      <button
        onClick={reset}
        className="w-full max-w-xs rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        נסי שוב
      </button>
    </div>
  );
}
