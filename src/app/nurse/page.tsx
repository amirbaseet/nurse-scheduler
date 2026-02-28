"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  CalendarDays,
  Megaphone,
  ClipboardList,
  Calendar,
  Sun,
  Moon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n/use-translation";
import { getWeekStart, formatDate, DAY_ORDER } from "@/lib/utils";
import { addWeeks } from "date-fns";

type Assignment = {
  id: string;
  day: string;
  shiftStart: string;
  shiftEnd: string;
  isOff: boolean;
  primaryClinic: { name: string } | null;
  secondaryClinic: { name: string } | null;
  patientCallProgram: string | null;
  patientCallCount: number | null;
};

type ScheduleResponse = {
  assignments: Assignment[];
  weekStart: string;
  status: string;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: string;
  createdAt: string;
  isRead: boolean;
};

type Task = {
  id: string;
  title: string;
  status: string;
};

function useDayLabels(): Record<string, string> {
  const { t } = useTranslation();
  return {
    SUN: t("sun"),
    MON: t("mon"),
    TUE: t("tue"),
    WED: t("wed"),
    THU: t("thu"),
    FRI: t("fri"),
    SAT: t("sat"),
  };
}

function parseHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

function getDayIndex(): number {
  return new Date().getDay(); // 0=Sun, 5=Fri, 6=Sat
}

function getTodayDayKey(): string {
  return DAY_ORDER[getDayIndex()];
}

function getTomorrowDayKey(): string {
  return DAY_ORDER[(getDayIndex() + 1) % 7];
}

function DayCard({
  assignment,
  label,
  isToday,
}: {
  assignment: Assignment;
  label: string;
  isToday?: boolean;
}) {
  const { t } = useTranslation();

  if (assignment.isOff) {
    return (
      <Card className={isToday ? "border-primary/50" : undefined}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-amber-500" />
              <span className="font-medium">{label}</span>
            </div>
            <Badge variant="secondary">{t("off_day")}</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hours = parseHours(assignment.shiftStart, assignment.shiftEnd);
  const clinicName = assignment.primaryClinic?.name ?? "—";
  const secondaryName = assignment.secondaryClinic?.name;

  return (
    <Card className={isToday ? "border-primary/50 shadow-sm" : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <span className="font-medium">{label}</span>
          </div>
          {isToday && (
            <Badge className="bg-primary/10 text-primary">{t("today")}</Badge>
          )}
        </div>
        <div className="space-y-1 ps-7">
          <div className="font-medium">
            {clinicName}
            {secondaryName && (
              <span className="text-muted-foreground"> + {secondaryName}</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {assignment.shiftStart} — {assignment.shiftEnd} ({hours}h)
          </div>
          {assignment.patientCallProgram && (
            <div className="text-sm text-muted-foreground">
              {t("program")}: {assignment.patientCallProgram}
              {assignment.patientCallCount != null &&
                ` (${assignment.patientCallCount})`}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CompactDayRow({ assignment }: { assignment: Assignment }) {
  const { t } = useTranslation();
  const dayLabels = useDayLabels();

  if (assignment.isOff) {
    return (
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="text-muted-foreground">
          {dayLabels[assignment.day]}
        </span>
        <Badge variant="secondary" className="text-xs">
          {t("off_day")}
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="font-medium">{dayLabels[assignment.day]}</span>
      <div className="text-end">
        <span>{assignment.primaryClinic?.name ?? "—"}</span>
        {assignment.patientCallProgram && (
          <span className="text-muted-foreground ms-1">
            ({assignment.patientCallProgram})
          </span>
        )}
        <span className="text-muted-foreground ms-2">
          {assignment.shiftStart}-{assignment.shiftEnd}
        </span>
      </div>
    </div>
  );
}

export default function NurseDashboard() {
  const { t } = useTranslation();
  const dayLabels = useDayLabels();
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [nextWeekSchedule, setNextWeekSchedule] =
    useState<ScheduleResponse | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [pendingTaskCount, setPendingTaskCount] = useState(0);

  useEffect(() => {
    const currentWeek = getWeekStart();
    const nextWeek = addWeeks(currentWeek, 1);
    const dayIndex = getDayIndex();
    const isFriSat = dayIndex === 5 || dayIndex === 6;

    const fetches: Promise<void>[] = [
      // Current week schedule
      fetch("/api/schedule/nurse/me")
        .then((r) => (r.ok ? r.json() : null))
        .then(setSchedule),
      // Announcements (latest 3)
      fetch("/api/announcements")
        .then((r) => (r.ok ? r.json() : []))
        .then((all: Announcement[]) => setAnnouncements(all.slice(0, 3))),
      // Tasks (count pending)
      fetch("/api/tasks/my")
        .then((r) => (r.ok ? r.json() : []))
        .then((tasks: Task[]) =>
          setPendingTaskCount(
            tasks.filter((t) => t.status === "PENDING").length,
          ),
        ),
    ];

    // Only fetch next week if it's Fri/Sat
    if (isFriSat) {
      fetches.push(
        fetch(`/api/schedule/nurse/me/${formatDate(nextWeek)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then(setNextWeekSchedule),
      );
    }

    Promise.all(fetches).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dayIndex = getDayIndex();
  const isFriSat = dayIndex === 5 || dayIndex === 6;
  const isPublished = schedule?.status === "PUBLISHED";

  const todayKey = getTodayDayKey();
  const tomorrowKey = getTomorrowDayKey();

  const todayAssignment = schedule?.assignments.find((a) => a.day === todayKey);
  const tomorrowAssignment = schedule?.assignments.find(
    (a) => a.day === tomorrowKey,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Greeting */}
      <h1 className="text-lg font-bold">{t("hello")} 👋</h1>

      {/* STATE B: No published schedule */}
      {!isPublished && (
        <Card>
          <CardContent className="py-8 text-center">
            <Calendar className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">{t("no_schedule")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("no_schedule_generate_first")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* STATE C: Fri/Sat — next week prominent */}
      {isPublished && isFriSat && (
        <>
          {/* Next week */}
          {nextWeekSchedule?.status === "PUBLISHED" ? (
            <Card className="border-primary/30">
              <CardContent className="p-4">
                <h2 className="font-bold mb-2 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  {t("next_week")}
                </h2>
                <div className="divide-y">
                  {nextWeekSchedule.assignments.map((a) => (
                    <CompactDayRow key={a.id} assignment={a} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary/30">
              <CardContent className="py-6 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("next_week")} — {t("no_schedule")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Current week (smaller) */}
          <Card className="opacity-70">
            <CardContent className="p-4">
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                {t("this_week")}
              </h2>
              <div className="divide-y">
                {schedule.assignments.map((a) => (
                  <CompactDayRow key={a.id} assignment={a} />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* STATE A: Normal day — today + tomorrow */}
      {isPublished && !isFriSat && (
        <div className="space-y-3">
          {todayAssignment ? (
            <DayCard
              assignment={todayAssignment}
              label={`${t("today")} — ${dayLabels[todayKey]}`}
              isToday
            />
          ) : (
            <Card className="border-primary/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Sun className="h-5 w-5 text-amber-500" />
                  <span className="font-medium">
                    {t("today")} — {dayLabels[todayKey]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 ps-7">
                  {t("off_day")}
                </p>
              </CardContent>
            </Card>
          )}

          {tomorrowAssignment ? (
            <DayCard
              assignment={tomorrowAssignment}
              label={`${t("tomorrow")} — ${dayLabels[tomorrowKey]}`}
            />
          ) : (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Moon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">
                    {t("tomorrow")} — {dayLabels[tomorrowKey]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 ps-7">
                  {t("off_day")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-medium mb-2 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              {t("announcements")}
            </h2>
            <div className="space-y-2">
              {announcements.map((ann) => (
                <div key={ann.id} className="flex items-start gap-2 text-sm">
                  {ann.priority === "URGENT" && (
                    <span className="text-destructive font-bold">!</span>
                  )}
                  <div className="min-w-0">
                    <span
                      className={
                        ann.isRead ? "text-muted-foreground" : "font-medium"
                      }
                    >
                      {ann.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending tasks count */}
      {pendingTaskCount > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t("tasks")}</span>
              </div>
              <Badge>{pendingTaskCount}</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
