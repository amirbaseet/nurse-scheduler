"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Wand2,
  Save,
  CalendarPlus,
  Clock,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { WeekNavigator } from "@/components/week-navigator";
import { StatusBadge } from "@/components/status-badge";
import { cn, getWeekStart, formatDate, DAY_ORDER } from "@/lib/utils";
import type {
  ScheduleWithAssignments,
  ScheduleAssignment,
} from "@/types/schedule";
import { useTranslation } from "@/i18n/use-translation";

// ── Types ──

type GapSlot = {
  key: string; // "clinicId:day" for uniqueness
  clinicId: string;
  clinicName: string;
  day: string;
  shiftStart: string;
  shiftEnd: string;
  hours: number;
};

type ClinicConfig = {
  clinicId: string;
  clinicName: string;
  day: string;
  shiftStart: string;
  shiftEnd: string;
  nursesNeeded: number;
  isActive: boolean;
};

type ManagerProfile = {
  nurseProfileId: string;
  contractHours: number;
  managementHours: number;
};

// ── Derive unfilled gaps ──

function deriveGaps(
  assignments: ScheduleAssignment[],
  configs: ClinicConfig[],
): GapSlot[] {
  // Count filled slots per (clinic, day) — exclude manager-self and OFF
  const filledMap = new Map<string, number>();
  for (const a of assignments) {
    if (a.isOff || a.isManagerSelf) continue;
    if (!a.primaryClinicId) continue;
    const key = `${a.primaryClinicId}:${a.day}`;
    filledMap.set(key, (filledMap.get(key) ?? 0) + 1);
  }

  const gaps: GapSlot[] = [];
  for (const cfg of configs) {
    if (!cfg.isActive || cfg.nursesNeeded === 0) continue;
    const key = `${cfg.clinicId}:${cfg.day}`;
    const filled = filledMap.get(key) ?? 0;
    const unfilled = cfg.nursesNeeded - filled;

    for (let i = 0; i < unfilled; i++) {
      gaps.push({
        key: unfilled > 1 ? `${key}:${i}` : key,
        clinicId: cfg.clinicId,
        clinicName: cfg.clinicName,
        day: cfg.day,
        shiftStart: cfg.shiftStart,
        shiftEnd: cfg.shiftEnd,
        hours: parseHours(cfg.shiftStart, cfg.shiftEnd),
      });
    }
  }

  // Sort by day order, then by clinic name
  return gaps.sort((a, b) => {
    const dayDiff =
      DAY_ORDER.indexOf(a.day as (typeof DAY_ORDER)[number]) -
      DAY_ORDER.indexOf(b.day as (typeof DAY_ORDER)[number]);
    return dayDiff !== 0
      ? dayDiff
      : a.clinicName.localeCompare(b.clinicName, "he");
  });
}

function parseHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

// ── Auto-suggest: greedy fill within remaining budget ──

function autoSuggest(
  gaps: GapSlot[],
  alreadySelected: Set<string>,
  remainingHours: number,
): Set<string> {
  const selected = new Set(alreadySelected);
  let budget = remainingHours;

  // Prioritize larger gaps first (greedy)
  const sorted = [...gaps]
    .filter((g) => !selected.has(g.key))
    .sort((a, b) => b.hours - a.hours);

  for (const gap of sorted) {
    // Only one gap per day for manager
    const dayTaken = Array.from(selected).some((k) => {
      const existing = gaps.find((g) => g.key === k);
      return existing?.day === gap.day;
    });
    if (dayTaken) continue;

    if (gap.hours <= budget) {
      selected.add(gap.key);
      budget -= gap.hours;
    }
  }

  return selected;
}

// ── Main Component ──

export function SelfAssignClient() {
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
  const DAY_LABELS_SHORT: Record<string, string> = {
    SUN: t("sun_short"),
    MON: t("mon_short"),
    TUE: t("tue_short"),
    WED: t("wed_short"),
    THU: t("thu_short"),
    FRI: t("fri_short"),
    SAT: t("sat_short"),
  };

  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [schedule, setSchedule] = useState<ScheduleWithAssignments | null>(
    null,
  );
  const [clinicConfigs, setClinicConfigs] = useState<ClinicConfig[]>([]);
  const [managerProfile, setManagerProfile] = useState<ManagerProfile | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected gap keys
  const [selectedGaps, setSelectedGaps] = useState<Set<string>>(new Set());

  // Fetch manager profile once
  useEffect(() => {
    fetch("/api/nurses")
      .then((r) => (r.ok ? r.json() : []))
      .then((nurses) => {
        const manager = nurses.find((n: { isManager: boolean }) => n.isManager);
        if (manager) {
          setManagerProfile({
            nurseProfileId: manager.id,
            contractHours: manager.contractHours ?? 0,
            managementHours: manager.managementHours ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Fetch schedule + clinic config on week change
  useEffect(() => {
    setLoading(true);
    setSaved(false);
    setError(null);
    setSelectedGaps(new Set());

    const weekStr = formatDate(weekStart);

    Promise.all([
      fetch(`/api/schedule/week/${weekStr}`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`/api/clinics/config/${weekStr}`).then((r) =>
        r.ok ? r.json() : [],
      ),
    ])
      .then(([sched, configs]) => {
        setSchedule(sched);
        setClinicConfigs(configs);

        // Pre-select already self-assigned gaps
        if (sched && managerProfile) {
          const existing = new Set<string>();
          for (const a of sched.assignments as ScheduleAssignment[]) {
            if (a.isManagerSelf && a.primaryClinicId) {
              existing.add(`${a.primaryClinicId}:${a.day}`);
            }
          }
          setSelectedGaps(existing);
        }
      })
      .catch(() => {
        setSchedule(null);
        setClinicConfigs([]);
      })
      .finally(() => setLoading(false));
  }, [weekStart, managerProfile]);

  // Derived data
  const gaps = useMemo(
    () => (schedule ? deriveGaps(schedule.assignments, clinicConfigs) : []),
    [schedule, clinicConfigs],
  );

  const managerAssignments = useMemo(
    () =>
      schedule && managerProfile
        ? schedule.assignments.filter(
            (a) => a.nurseId === managerProfile.nurseProfileId,
          )
        : [],
    [schedule, managerProfile],
  );

  // Hours calculation
  const availableHours = managerProfile
    ? managerProfile.contractHours - managerProfile.managementHours
    : 0;

  const existingAssignedHours = managerAssignments
    .filter((a) => !a.isOff)
    .reduce((sum, a) => sum + a.hours, 0);

  const selectedHours = gaps
    .filter((g) => selectedGaps.has(g.key))
    .reduce((sum, g) => sum + g.hours, 0);

  // For new selections, count only newly selected (not already assigned)
  const alreadyAssignedKeys = new Set(
    managerAssignments
      .filter((a) => a.isManagerSelf && a.primaryClinicId)
      .map((a) => `${a.primaryClinicId}:${a.day}`),
  );

  const newSelectedHours = gaps
    .filter((g) => selectedGaps.has(g.key) && !alreadyAssignedKeys.has(g.key))
    .reduce((sum, g) => sum + g.hours, 0);

  const totalAssignedHours =
    existingAssignedHours -
    // Subtract hours from unchecked previously-assigned gaps
    managerAssignments
      .filter(
        (a) =>
          a.isManagerSelf &&
          a.primaryClinicId &&
          !selectedGaps.has(`${a.primaryClinicId}:${a.day}`),
      )
      .reduce((sum, a) => sum + a.hours, 0) +
    newSelectedHours;

  const remainingHours = availableHours - totalAssignedHours;

  // Toggle gap selection
  const toggleGap = useCallback(
    (key: string) => {
      setSelectedGaps((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          // Check that this day isn't already assigned (non-self-assign)
          const gap = gaps.find((g) => g.key === key);
          if (gap) {
            const nonSelfOnDay = managerAssignments.some(
              (a) => a.day === gap.day && !a.isManagerSelf && !a.isOff,
            );
            if (!nonSelfOnDay) {
              next.add(key);
            }
          }
        }
        return next;
      });
      setSaved(false);
    },
    [gaps, managerAssignments],
  );

  // Auto-suggest
  const handleAutoSuggest = useCallback(() => {
    const suggested = autoSuggest(gaps, alreadyAssignedKeys, remainingHours);
    setSelectedGaps(suggested);
    setSaved(false);
  }, [gaps, alreadyAssignedKeys, remainingHours]);

  // Save
  const handleSave = useCallback(async () => {
    if (!schedule) return;
    setSaving(true);
    setError(null);

    const selectedGapData = gaps
      .filter((g) => selectedGaps.has(g.key))
      .map((g) => ({
        clinicId: g.clinicId,
        day: g.day,
        shiftStart: g.shiftStart,
        shiftEnd: g.shiftEnd,
        hours: g.hours,
      }));

    try {
      const res = await fetch(`/api/schedule/${schedule.id}/self-assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gaps: selectedGapData }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? t("self_assign_error"));
      }

      setSaved(true);

      // Re-fetch schedule to update the view
      const schedRes = await fetch(
        `/api/schedule/week/${formatDate(weekStart)}`,
      );
      if (schedRes.ok) {
        setSchedule(await schedRes.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("self_assign_error"));
    } finally {
      setSaving(false);
    }
  }, [schedule, gaps, selectedGaps, weekStart]);

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="me-2 text-muted-foreground">{t("loading_data")}</span>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="flex flex-col gap-4">
        <WeekNavigator weekStart={weekStart} onWeekChange={setWeekStart} />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <p className="text-muted-foreground">
              {t("no_schedule_generate_first")}
            </p>
            <Link href="/manager/schedule/generate">
              <Button>
                <CalendarPlus className="h-4 w-4 me-2" />
                {t("generate_schedule")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <WeekNavigator weekStart={weekStart} onWeekChange={setWeekStart} />
          <StatusBadge
            status={schedule.status as "DRAFT" | "GENERATED" | "PUBLISHED"}
          />
        </div>
      </div>

      {/* Split layout */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT: Unfilled gaps */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("unfilled_slots")}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoSuggest}
                disabled={gaps.length === 0}
              >
                <Wand2 className="h-4 w-4 me-2" />
                {t("auto_suggest")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {gaps.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {t("no_gaps")}
              </p>
            ) : (
              <div className="space-y-2">
                {gaps.map((gap) => {
                  const isChecked = selectedGaps.has(gap.key);
                  // Disable if manager already has a non-self assignment on this day
                  const hasNonSelfOnDay = managerAssignments.some(
                    (a) => a.day === gap.day && !a.isManagerSelf && !a.isOff,
                  );

                  return (
                    <label
                      key={gap.key}
                      className={cn(
                        "flex items-center gap-3 rounded-md border p-3 transition-colors cursor-pointer",
                        isChecked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/50",
                        hasNonSelfOnDay && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleGap(gap.key)}
                        disabled={hasNonSelfOnDay}
                      />
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded">
                            {DAY_LABELS_SHORT[gap.day]}
                          </span>
                          <span className="font-medium truncate">
                            {gap.clinicName}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {gap.shiftStart}–{gap.shiftEnd} ({gap.hours}{" "}
                          {t("hours_short")})
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: Manager's week view */}
        <div className="space-y-4">
          {/* Hours budget card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("your_week")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-muted p-3">
                  <div className="text-muted-foreground">
                    {t("contract_hours")}
                  </div>
                  <div className="text-lg font-bold">
                    {managerProfile?.contractHours ?? 0}
                  </div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <div className="text-muted-foreground">
                    {t("management_hours")}
                  </div>
                  <div className="text-lg font-bold">
                    {managerProfile?.managementHours ?? 0}
                  </div>
                </div>
                <div className="rounded-md bg-blue-50 p-3">
                  <div className="text-blue-700">{t("available_hours")}</div>
                  <div className="text-lg font-bold text-blue-700">
                    {availableHours}
                  </div>
                </div>
                <div
                  className={cn(
                    "rounded-md p-3",
                    remainingHours < 0
                      ? "bg-red-50"
                      : remainingHours === 0
                        ? "bg-green-50"
                        : "bg-amber-50",
                  )}
                >
                  <div
                    className={cn(
                      remainingHours < 0
                        ? "text-red-700"
                        : remainingHours === 0
                          ? "text-green-700"
                          : "text-amber-700",
                    )}
                  >
                    {t("remaining_label")}
                  </div>
                  <div
                    className={cn(
                      "text-lg font-bold",
                      remainingHours < 0
                        ? "text-red-700"
                        : remainingHours === 0
                          ? "text-green-700"
                          : "text-amber-700",
                    )}
                  >
                    {remainingHours.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>
                    {t("allocated_label")} {totalAssignedHours.toFixed(1)}{" "}
                    {t("hours_short")}
                  </span>
                  <span>
                    {t("available_label")} {availableHours} {t("hours_short")}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      remainingHours < 0 ? "bg-red-500" : "bg-primary",
                    )}
                    style={{
                      width: `${Math.min((totalAssignedHours / availableHours) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Day-by-day view */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {t("assignments_by_day")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {DAY_ORDER.map((day) => {
                // Existing non-self assignment on this day
                const existing = managerAssignments.find(
                  (a) => a.day === day && !a.isManagerSelf && !a.isOff,
                );
                // Self-assigned gap for this day
                const selfGap = gaps.find(
                  (g) => g.day === day && selectedGaps.has(g.key),
                );
                // Previously saved self-assignment
                const savedSelf = managerAssignments.find(
                  (a) => a.day === day && a.isManagerSelf,
                );

                // Resolve display values
                let displayName = "—";
                let displayTime = "";
                let displayHours = 0;
                let borderStyle = "border-border";

                if (existing) {
                  displayName = existing.primaryClinic?.name ?? "—";
                  displayTime =
                    existing.shiftStart && existing.shiftEnd
                      ? `${existing.shiftStart}–${existing.shiftEnd}`
                      : "";
                  displayHours = existing.hours;
                  borderStyle = "border-blue-300 bg-blue-50";
                } else if (selfGap) {
                  displayName = selfGap.clinicName;
                  displayTime = `${selfGap.shiftStart}–${selfGap.shiftEnd}`;
                  displayHours = selfGap.hours;
                  borderStyle = "border-purple-300 bg-purple-50";
                } else if (savedSelf) {
                  displayName = savedSelf.primaryClinic?.name ?? "—";
                  displayTime =
                    savedSelf.shiftStart && savedSelf.shiftEnd
                      ? `${savedSelf.shiftStart}–${savedSelf.shiftEnd}`
                      : "";
                  displayHours = savedSelf.hours;
                  borderStyle = "border-purple-300 bg-purple-50";
                }

                const hasAssignment = !!(existing || selfGap || savedSelf);

                return (
                  <div
                    key={day}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                      borderStyle,
                    )}
                  >
                    <span className="font-medium min-w-[60px]">
                      {DAY_LABELS[day]}
                    </span>
                    {hasAssignment ? (
                      <span className="text-end">
                        {displayName}{" "}
                        <span className="text-muted-foreground">
                          {displayTime} ({displayHours} {t("hours_short")})
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Separator />

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
            {saved && (
              <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                {t("self_assign_saved")}
              </div>
            )}
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin me-2" />
                  {t("saving_assignments")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 me-2" />
                  {t("save_done")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
