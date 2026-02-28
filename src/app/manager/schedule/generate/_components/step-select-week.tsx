"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, CalendarOff, ClipboardList, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WeekNavigator } from "@/components/week-navigator";
import { formatDate } from "@/lib/utils";
import type { ScheduleWithAssignments } from "@/types/schedule";
import { useTranslation } from "@/i18n/use-translation";

type SummaryData = {
  activeNurses: number;
  approvedTimeOffs: number;
  preferencesSubmitted: number;
  existingSchedule: ScheduleWithAssignments | null;
};

export function StepSelectWeek({
  weekStart,
  onWeekChange,
  onActiveNurseCount,
  onNext,
}: {
  weekStart: Date;
  onWeekChange: (d: Date) => void;
  onActiveNurseCount: (n: number) => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<SummaryData>({
    activeNurses: 0,
    approvedTimeOffs: 0,
    preferencesSubmitted: 0,
    existingSchedule: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const weekStr = formatDate(weekStart);
      const [nursesRes, timeOffsRes, prefsRes, scheduleRes] = await Promise.all(
        [
          fetch("/api/nurses"),
          fetch("/api/requests/pending"),
          fetch(`/api/preferences/week/${weekStr}`),
          fetch(`/api/schedule/week/${weekStr}`),
        ],
      );

      const nurses = nursesRes.ok ? await nursesRes.json() : [];
      const timeOffs = timeOffsRes.ok ? await timeOffsRes.json() : [];
      const prefs = prefsRes.ok ? await prefsRes.json() : [];
      const schedule = scheduleRes.ok ? await scheduleRes.json() : null;

      const activeCount = Array.isArray(nurses) ? nurses.length : 0;
      onActiveNurseCount(activeCount);

      setSummary({
        activeNurses: activeCount,
        approvedTimeOffs: Array.isArray(timeOffs) ? timeOffs.length : 0,
        preferencesSubmitted: Array.isArray(prefs) ? prefs.length : 0,
        existingSchedule: schedule,
      });
    } catch {
      // Silently handle — summary is informational
    } finally {
      setLoading(false);
    }
  }, [weekStart, onActiveNurseCount]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const hasExistingSchedule =
    summary.existingSchedule &&
    (summary.existingSchedule.status === "GENERATED" ||
      summary.existingSchedule.status === "PUBLISHED");

  return (
    <div className="space-y-6">
      {/* Week picker */}
      <div className="flex justify-center">
        <WeekNavigator weekStart={weekStart} onWeekChange={onWeekChange} />
      </div>

      {/* Existing schedule warning */}
      {hasExistingSchedule && (
        <div className="flex justify-center">
          <Badge
            variant="outline"
            className="gap-1 border-amber-300 bg-amber-50 text-amber-800"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("schedule_exists_warning")}
          </Badge>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<Users className="h-5 w-5 text-blue-600" />}
          label={t("active_nurses")}
          value={loading ? "..." : String(summary.activeNurses)}
        />
        <SummaryCard
          icon={<CalendarOff className="h-5 w-5 text-orange-600" />}
          label={t("approved_time_offs")}
          value={loading ? "..." : String(summary.approvedTimeOffs)}
        />
        <SummaryCard
          icon={<ClipboardList className="h-5 w-5 text-green-600" />}
          label={t("preferences_submitted")}
          value={
            loading
              ? "..."
              : `${summary.preferencesSubmitted}/${summary.activeNurses}`
          }
        />
      </div>

      {/* Next button */}
      <div className="flex justify-start">
        <Button onClick={onNext} disabled={loading}>
          {t("next")} ←
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icon}
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
