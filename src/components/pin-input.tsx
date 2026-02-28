"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function PinInput({
  length,
  onComplete,
  error,
  disabled,
}: {
  length: number;
  onComplete: (pin: string) => void;
  error?: boolean;
  disabled?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(""));
  const [shaking, setShaking] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset digits when length changes
  useEffect(() => {
    setDigits(Array(length).fill(""));
    inputRefs.current[0]?.focus();
  }, [length]);

  // Trigger shake animation on error
  useEffect(() => {
    if (error) {
      setShaking(true);
      setDigits(Array(length).fill(""));
      const timer = setTimeout(() => {
        setShaking(false);
        inputRefs.current[0]?.focus();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [error, length]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (disabled) return;
      // Only allow single digit
      const digit = value.replace(/\D/g, "").slice(-1);
      const newDigits = [...digits];
      newDigits[index] = digit;
      setDigits(newDigits);

      if (digit && index < length - 1) {
        // Auto-focus next
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when all filled
      if (digit && index === length - 1) {
        const pin = newDigits.join("");
        if (pin.length === length) {
          onComplete(pin);
        }
      }
    },
    [digits, length, onComplete, disabled],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key === "Backspace") {
        if (digits[index]) {
          // Clear current digit
          const newDigits = [...digits];
          newDigits[index] = "";
          setDigits(newDigits);
        } else if (index > 0) {
          // Move to previous and clear it
          const newDigits = [...digits];
          newDigits[index - 1] = "";
          setDigits(newDigits);
          inputRefs.current[index - 1]?.focus();
        }
        e.preventDefault();
      }
    },
    [digits, disabled],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      if (disabled) return;
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
      if (!pasted) return;
      const newDigits = Array(length).fill("");
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      setDigits(newDigits);
      if (pasted.length === length) {
        onComplete(pasted);
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
    },
    [length, onComplete, disabled],
  );

  return (
    <div
      className={cn(
        "flex gap-3 justify-center",
        shaking && "animate-shake",
      )}
      dir="ltr"
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className={cn(
            "h-14 w-12 rounded-xl border-2 bg-background text-center text-2xl font-bold",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
            "transition-colors",
            error
              ? "border-destructive"
              : digit
                ? "border-primary"
                : "border-muted-foreground/30",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />
      ))}
    </div>
  );
}
