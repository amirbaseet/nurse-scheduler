"use client";

import { useEffect, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { getWeekStart, formatDate, DAY_ORDER } from "@/lib/utils";
import { addWeeks } from "date-fns";

type NursePreference = {
  id: string;
  nurseId: string;
  nurse: { name: string };
  weekStart: string;
  shiftPreference: string | null;
  preferredDaysOff: string[];
  notes: string | null;
  submittedAt: string;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const SHIFT_STYLES: Record<string, string> = {
  morning: "bg-amber-100 text-amber-800",
  afternoon: "bg-indigo-100 text-indigo-800",
  anytime: "bg-gray-100 text-gray-800",
};

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

export default function ManagerPreferencesPage() {
  const { t } = useTranslation();
  const [weekStart, setWeekStart] = useState(() => addWeeks(getWeekStart(), 1));
  const [preferences, setPreferences] = useState<NursePreference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const weekParam = formatDate(weekStart);
    fetch(`/api/preferences/week/${weekParam}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setPreferences)
      .finally(() => setLoading(false));
  }, [weekStart]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("nurse_preferences")}</h1>

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

      {/* Stats bar */}
      <div className="text-sm text-muted-foreground">
        {preferences.length}/15 {t("preferences_count")}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && preferences.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("no_preferences")}
          </CardContent>
        </Card>
      )}

      {!loading && preferences.length > 0 && (
        <div className="space-y-3">
          {preferences.map((pref) => {
            const daysOff = pref.preferredDaysOff ?? [];
            const dayLabels = daysOff.map((day) => {
              const idx = (DAY_ORDER as readonly string[]).indexOf(day);
              return idx >= 0 ? t(DAY_KEYS[idx]) : day;
            });

            return (
              <Card key={pref.id}>
                <CardContent className="p-4">
                  {/* Nurse name */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold">{pref.nurse.name}</span>
                    </div>
                    {pref.shiftPreference && (
                      <Badge
                        className={
                          SHIFT_STYLES[pref.shiftPreference.toLowerCase()] ??
                          SHIFT_STYLES.anytime
                        }
                      >
                        {t(pref.shiftPreference.toLowerCase())}
                      </Badge>
                    )}
                  </div>

                  {/* Days off */}
                  {dayLabels.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      <span className="text-sm text-muted-foreground me-1">
                        {t("days_off")}:
                      </span>
                      {dayLabels.map((label) => (
                        <Badge
                          key={label}
                          variant="outline"
                          className="text-xs"
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {pref.notes && (
                    <p className="text-sm text-muted-foreground">
                      {t("notes")}: {pref.notes}
                    </p>
                  )}

                  {/* Timestamp */}
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("submitted_at")} {formatDateHe(pref.submittedAt)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
