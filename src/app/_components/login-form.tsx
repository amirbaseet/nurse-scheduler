"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PinInput } from "@/components/pin-input";
import { useTranslation } from "@/i18n/use-translation";

export function LoginForm() {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();

  const [pinLength, setPinLength] = useState<4 | 6>(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0); // increment to re-trigger shake
  const [locked, setLocked] = useState(false);

  const handleSubmit = useCallback(
    async (pin: string) => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });

        const data = await res.json();

        if (res.ok) {
          router.push(data.redirect);
          return;
        }

        if (res.status === 429) {
          setLocked(true);
          setError(t("locked_out"));
          setTimeout(() => setLocked(false), 5 * 60 * 1000);
        } else if (res.status === 401) {
          // If 4-digit PIN failed, maybe it's a 6-digit manager PIN
          if (pinLength === 4) {
            setPinLength(6);
            setError("");
          } else {
            setError(t("pin_incorrect"));
            setErrorKey((k) => k + 1);
          }
        } else {
          setError(data.error ?? t("pin_incorrect"));
          setErrorKey((k) => k + 1);
        }
      } catch {
        setError(t("connection_error"));
        setErrorKey((k) => k + 1);
      } finally {
        setLoading(false);
      }
    },
    [router, t, pinLength],
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Logo / Title */}
        <div className="space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t("app_name")}</h1>
          <p className="text-sm text-muted-foreground">{t("enter_pin")}</p>
        </div>

        {/* PIN Input */}
        <div className="space-y-4">
          <PinInput
            key={`${pinLength}-${errorKey}`}
            length={pinLength}
            onComplete={handleSubmit}
            error={!!error && !locked}
            disabled={loading || locked}
          />

          {/* Length toggle hint */}
          {pinLength === 4 && (
            <button
              type="button"
              onClick={() => setPinLength(6)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("manager_6_digits")}
            </button>
          )}
          {pinLength === 6 && (
            <button
              type="button"
              onClick={() => setPinLength(4)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("nurse_4_digits")}
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </div>

        {/* Language toggle */}
        <div className="pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocale(locale === "he" ? "ar" : "he")}
            className="text-muted-foreground"
          >
            {locale === "he" ? t("arabic") : t("hebrew")}
          </Button>
        </div>
      </div>
    </main>
  );
}
