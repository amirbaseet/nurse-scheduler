"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Stethoscope } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { WeekNavigator } from "@/components/week-navigator";
import { getWeekStart, formatDate, DAY_ORDER } from "@/lib/utils";
import { useTranslation } from "@/i18n/use-translation";

type PatientProgram = {
  id: string;
  name: string;
  nameAr: string | null;
  type: "PURE_PROGRAM" | "CLINIC_ADDON";
  linkedClinicCode: string | null;
  defaultHours: number | null;
};

type ProgramAssignment = {
  id: string;
  programId: string;
  nurseId: string;
  weekStart: string;
  day: string;
  patientCount: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
};

type NurseOption = { id: string; name: string };

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<PatientProgram[]>([]);
  const [assignments, setAssignments] = useState<ProgramAssignment[]>([]);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getWeekStart());

  const { t } = useTranslation();

  const DAY_LABELS: Record<string, string> = {
    SUN: t("sun"),
    MON: t("mon"),
    TUE: t("tue"),
    WED: t("wed"),
    THU: t("thu"),
    FRI: t("fri"),
    SAT: t("sat"),
  };

  const TYPE_LABELS: Record<string, string> = {
    PURE_PROGRAM: t("pure_program"),
    CLINIC_ADDON: t("clinic_addon"),
  };

  // Assign dialog state
  const [showAssign, setShowAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignProgramId, setAssignProgramId] = useState("");
  const [assignNurseId, setAssignNurseId] = useState("");
  const [assignDay, setAssignDay] = useState("SUN");
  const [assignPatientCount, setAssignPatientCount] = useState("");
  const [assignShiftStart, setAssignShiftStart] = useState("");
  const [assignShiftEnd, setAssignShiftEnd] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/programs").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/nurses").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([p, n]) => {
        setPrograms(p);
        setNurses(
          n.map((nurse: { user: { id: string; name: string } }) => ({
            id: nurse.user.id,
            name: nurse.user.name,
          })),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch assignments for the current week
  // Programs API doesn't have a week-filtered assignments endpoint,
  // so we'll use the program list and show basic info
  // For now, assignments would need a separate endpoint or be part of the program response

  const resetAssignForm = () => {
    setAssignProgramId("");
    setAssignNurseId("");
    setAssignDay("SUN");
    setAssignPatientCount("");
    setAssignShiftStart("");
    setAssignShiftEnd("");
  };

  const handleAssign = useCallback(async () => {
    if (!assignProgramId || !assignNurseId) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/programs/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: assignProgramId,
          nurseId: assignNurseId,
          weekStart: formatDate(weekStart),
          day: assignDay,
          patientCount: assignPatientCount
            ? parseInt(assignPatientCount, 10)
            : undefined,
          shiftStart: assignShiftStart || undefined,
          shiftEnd: assignShiftEnd || undefined,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setAssignments((prev) => [...prev, created]);
        setShowAssign(false);
        resetAssignForm();
      }
    } catch (err) {
      console.error("Failed to assign program:", err);
    } finally {
      setAssigning(false);
    }
  }, [
    assignProgramId,
    assignNurseId,
    weekStart,
    assignDay,
    assignPatientCount,
    assignShiftStart,
    assignShiftEnd,
  ]);

  const openAssignDialog = (programId?: string) => {
    if (programId) setAssignProgramId(programId);
    setShowAssign(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("programs")}</h1>
        <Button size="sm" onClick={() => openAssignDialog()}>
          <Plus className="h-4 w-4 me-2" />
          {t("assign_nurse_to_day")}
        </Button>
      </div>

      <WeekNavigator weekStart={weekStart} onWeekChange={setWeekStart} />

      {programs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("no_programs")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {programs.map((prog) => (
            <Card key={prog.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Stethoscope className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">{prog.name}</div>
                      {prog.nameAr && (
                        <p className="text-sm text-muted-foreground">
                          {prog.nameAr}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Badge variant="outline">
                          {TYPE_LABELS[prog.type]}
                        </Badge>
                        {prog.defaultHours && (
                          <span>
                            {prog.defaultHours} {t("hours")}
                          </span>
                        )}
                        {prog.linkedClinicCode && (
                          <span>
                            {t("clinic_label")}: {prog.linkedClinicCode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAssignDialog(prog.id)}
                  >
                    <Plus className="h-3 w-3 me-1" />
                    {t("assign")}
                  </Button>
                </div>

                {/* This week's assignments for this program */}
                {assignments
                  .filter((a) => a.programId === prog.id)
                  .map((a) => {
                    const nurse = nurses.find((n) => n.id === a.nurseId);
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 mt-2 text-sm ps-6 text-muted-foreground"
                      >
                        <Badge variant="secondary" className="text-xs">
                          {DAY_LABELS[a.day]}
                        </Badge>
                        <span>{nurse?.name ?? "—"}</span>
                        {a.shiftStart && a.shiftEnd && (
                          <span className="text-xs">
                            {a.shiftStart}-{a.shiftEnd}
                          </span>
                        )}
                        {a.patientCount != null && (
                          <span className="text-xs">
                            ({a.patientCount} {t("patients")})
                          </span>
                        )}
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign dialog */}
      <Dialog
        open={showAssign}
        onOpenChange={(open) => {
          if (!open) resetAssignForm();
          setShowAssign(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("assign_nurse_to_day")}</DialogTitle>
            <DialogDescription>{t("assign_to_program_desc")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>{t("program")}</Label>
              <Select
                value={assignProgramId}
                onValueChange={setAssignProgramId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("select_program")} />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>{t("nurse_label")}</Label>
              <Select value={assignNurseId} onValueChange={setAssignNurseId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("select_nurse")} />
                </SelectTrigger>
                <SelectContent>
                  {nurses.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>{t("day_label")}</Label>
              <Select value={assignDay} onValueChange={setAssignDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_ORDER.map((day) => (
                    <SelectItem key={day} value={day}>
                      {DAY_LABELS[day]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("patients")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={assignPatientCount}
                  onChange={(e) => setAssignPatientCount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("shift_start")}</Label>
                <Input
                  type="time"
                  value={assignShiftStart}
                  onChange={(e) => setAssignShiftStart(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("shift_end")}</Label>
                <Input
                  type="time"
                  value={assignShiftEnd}
                  onChange={(e) => setAssignShiftEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAssign(false)}
              disabled={assigning}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleAssign}
              disabled={assigning || !assignProgramId || !assignNurseId}
            >
              {assigning ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : (
                <Plus className="h-4 w-4 me-2" />
              )}
              {t("assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
