"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Download, CalendarPlus, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WeekNavigator } from "@/components/week-navigator";
import { StatusBadge } from "@/components/status-badge";
import { getWeekStart, formatDate } from "@/lib/utils";
import { useTranslation } from "@/i18n/use-translation";
import type {
  ScheduleWithAssignments,
  ScheduleAssignment,
} from "@/types/schedule";
import { ScheduleGrid } from "./schedule-grid";
import { EditAssignmentDialog } from "./edit-assignment-dialog";

type NurseInfo = {
  id: string;
  name: string;
  contractHours: number;
  shiftPref: "MORNING" | "AFTERNOON" | "ANYTIME";
};

type ClinicOption = {
  id: string;
  name: string;
};

export function SchedulePageClient() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [schedule, setSchedule] = useState<ScheduleWithAssignments | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const { t } = useTranslation();

  // Reference data (fetched once)
  const [nurseMap, setNurseMap] = useState<Map<string, NurseInfo>>(new Map());
  const [clinics, setClinics] = useState<ClinicOption[]>([]);

  // Edit dialog state
  const [editingAssignment, setEditingAssignment] =
    useState<ScheduleAssignment | null>(null);

  // Fetch nurses + clinics once
  useEffect(() => {
    Promise.all([fetch("/api/nurses"), fetch("/api/clinics")])
      .then(async ([nRes, cRes]) => {
        if (nRes.ok) {
          const nurses = await nRes.json();
          const map = new Map<string, NurseInfo>();
          for (const n of nurses) {
            map.set(n.userId, {
              id: n.userId,
              name: n.user.name,
              contractHours: n.contractHours,
              shiftPref: n.shiftPreference ?? "ANYTIME",
            });
          }
          setNurseMap(map);
        }
        if (cRes.ok) {
          const allClinics = await cRes.json();
          setClinics(
            allClinics
              .filter((c: { isActive: boolean }) => c.isActive)
              .map((c: { id: string; name: string }) => ({
                id: c.id,
                name: c.name,
              })),
          );
        }
      })
      .catch(() => {});
  }, []);

  // Fetch schedule on week change
  useEffect(() => {
    setLoading(true);
    fetch(`/api/schedule/week/${formatDate(weekStart)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSchedule(data))
      .catch(() => setSchedule(null))
      .finally(() => setLoading(false));
  }, [weekStart]);

  // Export handler
  const handleExport = useCallback(async () => {
    if (!schedule) return;
    setExporting(true);
    try {
      const res = await fetch(
        `/api/schedule/week/${formatDate(weekStart)}/export`,
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schedule-${formatDate(weekStart)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  }, [schedule, weekStart]);

  // Publish handler
  const handlePublish = useCallback(async () => {
    if (!schedule) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/schedule/${schedule.id}/publish`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(t("publish_error"));
      setSchedule({ ...schedule, status: "PUBLISHED" });
    } catch (err) {
      alert(err instanceof Error ? err.message : t("publish_error"));
    } finally {
      setPublishing(false);
    }
  }, [schedule, t]);

  // Cell click → open edit dialog
  const handleCellClick = useCallback((assignment: ScheduleAssignment) => {
    setEditingAssignment(assignment);
  }, []);

  // Swap two assignments (drag-and-drop)
  const handleSwap = useCallback(
    async (sourceId: string, targetId: string) => {
      if (!schedule) return;

      const sourceAssignment = schedule.assignments.find(
        (a) => a.id === sourceId,
      );
      const targetAssignment = schedule.assignments.find(
        (a) => a.id === targetId,
      );
      if (!sourceAssignment || !targetAssignment) return;

      // Optimistic update: swap nurseIds locally
      const updatedAssignments = schedule.assignments.map((a) => {
        if (a.id === sourceId) {
          return {
            ...a,
            nurseId: targetAssignment.nurseId,
            nurse: targetAssignment.nurse,
          };
        }
        if (a.id === targetId) {
          return {
            ...a,
            nurseId: sourceAssignment.nurseId,
            nurse: sourceAssignment.nurse,
          };
        }
        return a;
      });
      setSchedule({ ...schedule, assignments: updatedAssignments });

      try {
        const [r1, r2] = await Promise.all([
          fetch(`/api/schedule/${schedule.id}/assign`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignmentId: sourceId,
              nurseId: targetAssignment.nurseId,
            }),
          }),
          fetch(`/api/schedule/${schedule.id}/assign`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignmentId: targetId,
              nurseId: sourceAssignment.nurseId,
            }),
          }),
        ]);

        if (!r1.ok || !r2.ok) throw new Error("Swap failed");
      } catch {
        // Rollback on error
        setSchedule({ ...schedule });
      }
    },
    [schedule],
  );

  // After edit dialog saves
  const handleAssignmentSaved = useCallback(
    (updated: ScheduleAssignment) => {
      if (!schedule) return;
      setSchedule({
        ...schedule,
        assignments: schedule.assignments.map((a) =>
          a.id === updated.id ? updated : a,
        ),
      });
      setEditingAssignment(null);
    },
    [schedule],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <WeekNavigator weekStart={weekStart} onWeekChange={setWeekStart} />
          {schedule && (
            <StatusBadge
              status={schedule.status as "DRAFT" | "GENERATED" | "PUBLISHED"}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {schedule && schedule.status === "GENERATED" && (
            <Button size="sm" disabled={publishing} onClick={handlePublish}>
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : (
                <Send className="h-4 w-4 me-2" />
              )}
              {publishing ? t("publishing") : t("publish_schedule")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!schedule || exporting}
            onClick={handleExport}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin me-2" />
            ) : (
              <Download className="h-4 w-4 me-2" />
            )}
            {t("export_excel")}
          </Button>
        </div>
      </div>

      {/* Main content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="me-2 text-muted-foreground">
            {t("loading_schedule")}
          </span>
        </div>
      ) : !schedule ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <p className="text-muted-foreground">{t("no_schedule_for_week")}</p>
            <Link href="/manager/schedule/generate">
              <Button>
                <CalendarPlus className="h-4 w-4 me-2" />
                {t("generate_schedule")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ScheduleGrid
          assignments={schedule.assignments}
          nurseMap={nurseMap}
          onCellClick={handleCellClick}
          onSwap={handleSwap}
        />
      )}

      {/* Edit dialog */}
      <EditAssignmentDialog
        assignment={editingAssignment}
        scheduleId={schedule?.id ?? null}
        nurses={Array.from(nurseMap.values())}
        clinics={clinics}
        onClose={() => setEditingAssignment(null)}
        onSaved={handleAssignmentSaved}
      />
    </div>
  );
}
