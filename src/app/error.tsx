"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <span className="text-3xl">!</span>
      </div>
      <h1 className="text-xl font-bold">אירעה שגיאה</h1>
      <p className="text-sm text-muted-foreground">
        משהו השתבש. נסה שוב או חזור לדף הראשי.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          נסה שוב
        </button>
        <a
          href="/"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          חזרה לדף הראשי
        </a>
      </div>
    </div>
  );
}
