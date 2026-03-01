"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Send,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate, DAY_ORDER } from "@/lib/utils";
import type {
  GenerateResponse,
  ScheduleWithAssignments,
  ScheduleAssignment,
  ScheduleWarning,
} from "@/types/schedule";
import { useTranslation } from "@/i18n/use-translation";

function getQualityColor(score: number) {
  if (score >= 70) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 50) return "text-yellow-700 bg-yellow-50 border-yellow-200";
  return "text-red-700 bg-red-50 border-red-200";
}

const WARNING_ICONS: Record<string, React.ReactNode> = {
  error: <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />,
  info: <Info className="h-4 w-4 text-blue-500 shrink-0" />,
};

// Group assignments by nurse for the grid
function buildGrid(assignments: ScheduleAssignment[]) {
  const nurseMap = new Map<
    string,
    { name: string; days: Map<string, ScheduleAssignment> }
  >();

  for (const a of assignments) {
    if (!nurseMap.has(a.nurseId)) {
      nurseMap.set(a.nurseId, {
        name: a.nurse.user.name,
        days: new Map(),
      });
    }
    nurseMap.get(a.nurseId)!.days.set(a.day, a);
  }

  // Sort by nurse name
  return Array.from(nurseMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "he"),
  );
}

export function StepReviewEdit({
  weekStart,
  generateResult,
  isPublishing,
  onBack,
  onPublish,
}: {
  weekStart: Date;
  generateResult: GenerateResponse;
  isPublishing: boolean;
  onBack: () => void;
  onPublish: () => void;
}) {
  const { t } = useTranslation();
  const DAY_LABELS: Record<string, string> = {
    SUN: t("sun_short"),
    MON: t("mon_short"),
    TUE: t("tue_short"),
    WED: t("wed_short"),
    THU: t("thu_short"),
    FRI: t("fri_short"),
    SAT: t("sat_short"),
  };

  const [schedule, setSchedule] = useState<ScheduleWithAssignments | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/schedule/week/${formatDate(weekStart)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSchedule(data))
      .finally(() => setLoading(false));
  }, [weekStart]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="me-2 text-muted-foreground">
          {t("loading_schedule")}
        </span>
      </div>
    );
  }

  const grid = schedule ? buildGrid(schedule.assignments) : [];
  const { qualityScore, warnings, managerGaps } = generateResult;

  // Sort warnings: error → warning → info
  const sortedWarnings = [...warnings].sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return order[a.level] - order[b.level];
  });

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Main area — Schedule Grid */}
      <div className="flex-1 min-w-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("weekly_schedule")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky start-0 bg-background z-10 min-w-[120px]">
                    {t("role_nurse")}
                  </TableHead>
                  {DAY_ORDER.map((day) => (
                    <TableHead key={day} className="text-center min-w-[80px]">
                      {DAY_LABELS[day]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {grid.map((nurse) => (
                  <TableRow key={nurse.name}>
                    <TableCell className="sticky start-0 bg-background z-10 font-medium">
                      {nurse.name}
                    </TableCell>
                    {DAY_ORDER.map((day) => {
                      const a = nurse.days.get(day);
                      return (
                        <TableCell key={day} className="text-center p-1">
                          <ScheduleCell assignment={a ?? null} />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {grid.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      {t("no_schedule_data")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar — Quality, Warnings, Gaps */}
      <div className="w-full space-y-4 lg:w-72 shrink-0">
        {/* Quality Score */}
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {t("quality_score")}
            </p>
            <div
              className={cn(
                "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-3xl font-bold",
                getQualityColor(qualityScore),
              )}
            >
              {qualityScore}
            </div>
          </CardContent>
        </Card>

        {/* Warnings — grouped by day */}
        {sortedWarnings.length > 0 && (
          <WarningsGrouped warnings={sortedWarnings} dayLabels={DAY_LABELS} />
        )}

        {/* Manager Gaps — grouped by clinic */}
        {managerGaps.length > 0 && (
          <GapsGrouped
            gaps={managerGaps}
            dayLabels={DAY_LABELS}
            hoursLabel={t("hours_short")}
            title={t("unfilled_gaps_label")}
          />
        )}

        <Separator />

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={onBack} className="w-full">
            <RefreshCw className="h-4 w-4 me-2" />
            {t("regenerate")}
          </Button>
          <Button
            onClick={onPublish}
            disabled={isPublishing}
            className="w-full"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin me-2" />
                {t("publishing")}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 me-2" />
                {t("publish_schedule")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScheduleCell({
  assignment,
}: {
  assignment: ScheduleAssignment | null;
}) {
  const { t } = useTranslation();

  if (!assignment) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (assignment.isOff) {
    return (
      <div className="rounded bg-gray-100 px-1 py-0.5 text-xs text-muted-foreground">
        {t("off_day")}
      </div>
    );
  }

  const clinicName =
    assignment.primaryClinic?.name ?? assignment.secondaryClinic?.name ?? "—";
  const time =
    assignment.shiftStart && assignment.shiftEnd
      ? `${assignment.shiftStart}–${assignment.shiftEnd}`
      : "";

  return (
    <div
      className={cn(
        "rounded px-1 py-0.5 text-xs",
        assignment.isFixed ? "border border-blue-500 bg-blue-50" : "bg-muted",
      )}
    >
      <div className="font-medium truncate" title={clinicName}>
        {clinicName}
      </div>
      {time && <div className="text-[10px] text-muted-foreground">{time}</div>}
    </div>
  );
}

function WarningsGrouped({
  warnings,
  dayLabels,
}: {
  warnings: ScheduleWarning[];
  dayLabels: Record<string, string>;
}) {
  // Separate slot warnings (have day+clinic) from other warnings
  const slotWarnings = warnings.filter((w) => w.day && w.clinicName);
  const otherWarnings = warnings.filter((w) => !w.day || !w.clinicName);

  // Group slot warnings by day
  const byDay = new Map<string, string[]>();
  for (const w of slotWarnings) {
    const day = w.day!;
    const existing = byDay.get(day) ?? [];
    byDay.set(day, [...existing, w.clinicName!]);
  }

  // Sort days by DAY_ORDER
  const dayOrder = DAY_ORDER as readonly string[];
  const sortedDays = Array.from(byDay.entries()).sort(
    (a, b) => dayOrder.indexOf(a[0]) - dayOrder.indexOf(b[0]),
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span>
            {warnings.length} {warnings.length === 1 ? "warning" : "warnings"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedDays.map(([day, clinicNames]) => (
          <div key={day}>
            <div className="text-xs font-semibold text-muted-foreground mb-1">
              {dayLabels[day] ?? day} ({clinicNames.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {clinicNames.map((name: string, i: number) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs border-red-200 bg-red-50 text-red-700"
                >
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        ))}
        {otherWarnings.map((w, i) => (
          <div key={`other-${i}`} className="flex items-start gap-2 text-sm">
            {WARNING_ICONS[w.level]}
            <span>{w.message}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GapsGrouped({
  gaps,
  dayLabels,
  hoursLabel,
  title,
}: {
  gaps: Array<{
    clinicId: string;
    clinicName: string;
    day: string;
    shiftStart: string;
    shiftEnd: string;
    hours: number;
  }>;
  dayLabels: Record<string, string>;
  hoursLabel: string;
  title: string;
}) {
  // Group by clinic (clinicId + shift time for uniqueness)
  const byClinic = new Map<
    string,
    {
      clinicName: string;
      shiftStart: string;
      shiftEnd: string;
      hours: number;
      days: string[];
      gapCount: number;
    }
  >();

  for (const gap of gaps) {
    const key = `${gap.clinicId}|${gap.shiftStart}|${gap.shiftEnd}`;
    const existing = byClinic.get(key);
    if (existing) {
      // Deduplicate days (clinic may need 2+ nurses on same day)
      const days = existing.days.includes(gap.day)
        ? existing.days
        : [...existing.days, gap.day];
      byClinic.set(key, { ...existing, days, gapCount: existing.gapCount + 1 });
    } else {
      byClinic.set(key, {
        clinicName: gap.clinicName,
        shiftStart: gap.shiftStart,
        shiftEnd: gap.shiftEnd,
        hours: gap.hours,
        days: [gap.day],
        gapCount: 1,
      });
    }
  }

  // Sort days within each group by DAY_ORDER
  const dayOrder = DAY_ORDER as readonly string[];
  const sortedGroups = Array.from(byClinic.values()).map((group) => ({
    ...group,
    days: [...group.days].sort(
      (a: string, b: string) => dayOrder.indexOf(a) - dayOrder.indexOf(b),
    ),
  }));

  // Sort groups by number of unfilled days (most gaps first)
  sortedGroups.sort((a, b) => b.days.length - a.days.length);

  const totalHours = gaps.reduce((sum, g) => sum + g.hours, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>
            {title} ({gaps.length})
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {totalHours} {hoursLabel}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedGroups.map((group, i) => (
          <div key={i} className="rounded-md border p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{group.clinicName}</span>
              <span className="text-[10px] text-muted-foreground">
                {group.shiftStart}–{group.shiftEnd} ({group.hours} {hoursLabel})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {group.days.map((day: string) => (
                <Badge
                  key={day}
                  variant="outline"
                  className="text-xs border-orange-200 bg-orange-50 text-orange-700"
                >
                  {dayLabels[day] ?? day}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
