"use client";

import { useEffect, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { getWeekStart, formatDate, DAY_ORDER } from "@/lib/utils";
import { parseJsonArray } from "@/lib/json-arrays";
import { addWeeks } from "date-fns";

type WeeklyPreference = {
  id: string;
  weekStart: string;
  shiftPreference: string | null;
  preferredDaysOff: string | null;
  notes: string | null;
  submittedAt: string;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const SHIFT_OPTIONS = [
  { value: "MORNING", label: "morning" },
  { value: "AFTERNOON", label: "afternoon" },
  { value: "ANYTIME", label: "anytime" },
] as const;

function formatDateHe(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  return `${fmt(weekStart)} - ${fmt(end)}`;
}

export default function NursePreferencesPage() {
  const { t } = useTranslation();
  const [weekStart, setWeekStart] = useState(() => addWeeks(getWeekStart(), 1));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [existing, setExisting] = useState<WeeklyPreference | null>(null);

  // Form state — values are uppercase to match API enums
  const [shiftPref, setShiftPref] = useState<string>("ANYTIME");
  const [daysOff, setDaysOff] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setLoading(true);
    const weekParam = formatDate(weekStart);
    fetch(`/api/preferences/my/${weekParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: WeeklyPreference | null) => {
        setExisting(data);
        if (data) {
          setShiftPref(data.shiftPreference ?? "ANYTIME");
          setDaysOff(parseJsonArray(data.preferredDaysOff));
          setNotes(data.notes ?? "");
        } else {
          setShiftPref("ANYTIME");
          setDaysOff([]);
          setNotes("");
        }
      })
      .finally(() => setLoading(false));
  }, [weekStart]);

  const toggleDay = (day: string) => {
    setDaysOff((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSuccessMsg("");
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: formatDate(weekStart),
          shiftPreference: shiftPref,
          preferredDaysOff: daysOff,
          notes: notes || undefined,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setExisting(saved);
        setSuccessMsg(t("preferences_saved"));
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error("Failed to save preferences:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">{t("preferences")}</h1>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setWeekStart((w) => addWeeks(w, -1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
        <span className="font-medium text-sm">
          {t("schedule")} {formatWeekLabel(weekStart)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Status indicator */}
      {existing ? (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200 self-start"
        >
          <Check className="h-3.5 w-3.5 me-1" />
          {t("submitted_at")} {formatDateHe(existing.submittedAt)}
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 self-start"
        >
          {t("not_submitted")}
        </Badge>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Shift preference */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("shift_preference")}
              </label>
              <div className="flex gap-2">
                {SHIFT_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={shiftPref === opt.value ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setShiftPref(opt.value)}
                  >
                    {t(opt.label)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Days off */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("select_days_off")}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {DAY_ORDER.map((day, idx) => (
                  <Button
                    key={day}
                    variant={daysOff.includes(day) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleDay(day)}
                  >
                    {t(DAY_KEYS[idx])}
                  </Button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                {t("notes")}
              </label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Hint */}
            <p className="text-xs text-muted-foreground">
              {t("submit_before_thursday")}
            </p>

            {/* Submit */}
            <Button
              className="w-full"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin me-1" />}
              {t("submit")}
            </Button>

            {/* Success */}
            {successMsg && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 text-center">
                {successMsg}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
