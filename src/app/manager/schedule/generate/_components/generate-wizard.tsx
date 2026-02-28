"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, getWeekStart, formatDate } from "@/lib/utils";
import type { GenerateResponse } from "@/types/schedule";
import { StepSelectWeek } from "./step-select-week";
import { StepReviewConfig } from "./step-review-config";
import { StepReviewEdit } from "./step-review-edit";

const STEPS = [
  { num: 1, label: "בחירת שבוע" },
  { num: 2, label: "סקירת הגדרות" },
  { num: 3, label: "בדיקה ועריכה" },
  { num: 4, label: "פורסם" },
] as const;

export function GenerateWizard() {
  const [step, setStep] = useState(1);
  const [weekStart, setWeekStart] = useState<Date>(
    getWeekStart(new Date()),
  );
  const [generateResult, setGenerateResult] =
    useState<GenerateResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeNurseCount, setActiveNurseCount] = useState(0);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/schedule/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: formatDate(weekStart) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "שגיאה ביצירת הלו״ז");
      }
      const data: GenerateResponse = await res.json();
      setGenerateResult(data);
      setStep(3);
    } catch (error) {
      alert(error instanceof Error ? error.message : "שגיאה ביצירת הלו״ז");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handlePublish() {
    if (!generateResult) return;
    setIsPublishing(true);
    try {
      const res = await fetch(
        `/api/schedule/${generateResult.schedule.id}/publish`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "שגיאה בפרסום");
      }
      setStep(4);
    } catch (error) {
      alert(error instanceof Error ? error.message : "שגיאה בפרסום");
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <nav className="flex items-center justify-center gap-2">
        {STEPS.map(({ num, label }) => (
          <div key={num} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  step === num
                    ? "bg-primary text-primary-foreground"
                    : step > num
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {step > num ? "✓" : num}
              </div>
              <span
                className={cn(
                  "text-xs",
                  step === num
                    ? "font-medium text-primary"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {num < 4 && (
              <div
                className={cn(
                  "mb-5 h-px w-12",
                  step > num ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        ))}
      </nav>

      {/* Step content */}
      {step === 1 && (
        <StepSelectWeek
          weekStart={weekStart}
          onWeekChange={setWeekStart}
          onActiveNurseCount={setActiveNurseCount}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepReviewConfig
          weekStart={weekStart}
          isGenerating={isGenerating}
          onBack={() => setStep(1)}
          onGenerate={handleGenerate}
        />
      )}

      {step === 3 && generateResult && (
        <StepReviewEdit
          weekStart={weekStart}
          generateResult={generateResult}
          isPublishing={isPublishing}
          onBack={() => setStep(2)}
          onPublish={handlePublish}
        />
      )}

      {step === 4 && (
        <Card className="mx-auto max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-2">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            </div>
            <CardTitle className="text-xl">הלו״ז פורסם בהצלחה!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {activeNurseCount} אחיות יקבלו התראה
            </p>
            <Button asChild>
              <a href="/manager/schedule">צפייה בלו״ז</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
