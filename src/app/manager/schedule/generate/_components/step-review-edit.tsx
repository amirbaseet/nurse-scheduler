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

        {/* Warnings */}
        {sortedWarnings.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {t("warnings")} ({sortedWarnings.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sortedWarnings.map((w, i) => (
                <WarningRow key={i} warning={w} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Manager Gaps */}
        {managerGaps.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {t("unfilled_gaps_label")} ({managerGaps.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {managerGaps.map((gap, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">{gap.clinicName}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — {DAY_LABELS[gap.day] ?? gap.day} — {gap.shiftStart}–
                      {gap.shiftEnd} ({gap.hours} {t("hours_short")})
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
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

function WarningRow({ warning }: { warning: ScheduleWarning }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {WARNING_ICONS[warning.level]}
      <span>{warning.message}</span>
    </div>
  );
}
