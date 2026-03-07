"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, getWeekStart, formatDate } from "@/lib/utils";
import type { GenerateResponse } from "@/types/schedule";
import type { AlgorithmVersion } from "@/algorithm/algorithm-options";
import { StepSelectWeek } from "./step-select-week";
import { StepReviewConfig } from "./step-review-config";
import { StepReviewEdit } from "./step-review-edit";
import { useTranslation } from "@/i18n/use-translation";

export function GenerateWizard() {
  const { t } = useTranslation();

  const STEPS = [
    { num: 1, label: t("step_select_week") },
    { num: 2, label: t("step_review_config") },
    { num: 3, label: t("step_review_edit") },
    { num: 4, label: t("step_published") },
  ] as const;
  const [step, setStep] = useState(1);
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [generateResult, setGenerateResult] = useState<GenerateResponse | null>(
    null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeNurseCount, setActiveNurseCount] = useState(0);
  const [algorithmVersion, setAlgorithmVersion] =
    useState<AlgorithmVersion>("v1-clinic-first");

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/schedule/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: formatDate(weekStart),
          algorithmVersion,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("generate_error"));
      }
      const data: GenerateResponse = await res.json();
      setGenerateResult(data);
      setStep(3);
    } catch (error) {
      alert(error instanceof Error ? error.message : t("generate_error"));
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
        throw new Error(err.error || t("publish_error"));
      }
      setStep(4);
    } catch (error) {
      alert(error instanceof Error ? error.message : t("publish_error"));
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
          algorithmVersion={algorithmVersion}
          onAlgorithmChange={setAlgorithmVersion}
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
            <CardTitle className="text-xl">
              {t("schedule_published_msg")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {activeNurseCount} {t("nurses_notified")}
            </p>
            <Button asChild>
              <a href="/manager/schedule">{t("view_schedule")}</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
