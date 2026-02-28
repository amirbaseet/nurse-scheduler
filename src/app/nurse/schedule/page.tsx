"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Sun,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { getWeekStart, formatDate, DAY_ORDER } from "@/lib/utils";
import { addWeeks } from "date-fns";

type Assignment = {
  id: string;
  day: string;
  shiftStart: string;
  shiftEnd: string;
  hours: number;
  isOff: boolean;
  isFixed: boolean;
  primaryClinic: { id: string; name: string } | null;
  secondaryClinic: { id: string; name: string } | null;
  patientCallProgram: string | null;
  patientCallCount: number | null;
};

type ScheduleResponse = {
  assignments: Assignment[];
  weekStart: string;
  status: "PUBLISHED" | "NOT_PUBLISHED";
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function parseHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  return `${fmt(weekStart)} - ${fmt(end)}`;
}

export default function NurseSchedulePage() {
  const { t } = useTranslation();
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const weekParam = formatDate(weekStart);
    fetch(`/api/schedule/nurse/me/${weekParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setSchedule)
      .finally(() => setLoading(false));
  }, [weekStart]);

  const todayDayKey = DAY_ORDER[new Date().getDay()];

  const sortedAssignments = schedule?.assignments
    ? [...schedule.assignments].sort(
        (a, b) =>
          (DAY_ORDER as readonly string[]).indexOf(a.day) -
          (DAY_ORDER as readonly string[]).indexOf(b.day),
      )
    : [];

  const totalHours = sortedAssignments.reduce((sum, a) => {
    if (a.isOff) return sum;
    return sum + (a.hours ?? parseHours(a.shiftStart, a.shiftEnd));
  }, 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">{t("my_schedule")}</h1>

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

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && (!schedule || schedule.status !== "PUBLISHED") && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="mx-auto h-10 w-10 mb-3" />
            {t("no_schedule")}
          </CardContent>
        </Card>
      )}

      {!loading && schedule?.status === "PUBLISHED" && (
        <>
          <div className="space-y-2">
            {sortedAssignments.map((a) => {
              const dayIdx = (DAY_ORDER as readonly string[]).indexOf(a.day);
              const dayLabel = t(DAY_KEYS[dayIdx]);
              const isToday = a.day === todayDayKey;

              if (a.isOff) {
                return (
                  <Card
                    key={a.id}
                    className={isToday ? "border-primary/50" : undefined}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sun className="h-5 w-5 text-amber-500" />
                          <span className="font-medium">{dayLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isToday && (
                            <Badge className="bg-primary/10 text-primary">
                              {t("today")}
                            </Badge>
                          )}
                          <Badge variant="secondary">{t("off_day")}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              const hours = a.hours ?? parseHours(a.shiftStart, a.shiftEnd);
              return (
                <Card
                  key={a.id}
                  className={
                    isToday ? "border-primary/50 shadow-sm" : undefined
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        <span className="font-medium">{dayLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isToday && (
                          <Badge className="bg-primary/10 text-primary">
                            {t("today")}
                          </Badge>
                        )}
                        {a.isFixed && (
                          <Badge variant="outline" className="text-xs">
                            {t("permanent")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="ps-7 space-y-0.5">
                      <div className="font-medium">
                        {a.primaryClinic?.name ?? "—"}
                        {a.secondaryClinic && (
                          <span className="text-muted-foreground">
                            {" "}
                            + {a.secondaryClinic.name}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {a.shiftStart} — {a.shiftEnd} ({hours}h)
                      </div>
                      {a.patientCallProgram && (
                        <div className="text-sm text-muted-foreground">
                          {t("program")}: {a.patientCallProgram}
                          {a.patientCallCount != null &&
                            ` (${a.patientCallCount})`}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Total hours */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t("total_hours")}</span>
                <Badge>{totalHours}h</Badge>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
