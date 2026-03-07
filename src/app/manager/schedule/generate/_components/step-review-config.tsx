"use client";

import { useEffect, useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate, DAY_ORDER } from "@/lib/utils";
import type { MergedConfig } from "@/types/clinic";
import type {
  AlgorithmVersion,
  ShiftBuilderMode,
} from "@/algorithm/algorithm-options";
import { ALGORITHM_OPTIONS } from "@/algorithm/algorithm-options";
import { useTranslation } from "@/i18n/use-translation";

type TimeOff = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  nurse: { name: string };
};

type NurseWithFixed = {
  id: string;
  user: { name: string };
  fixedAssignments: Array<{
    day: string;
    weekStart: string;
    clinic: { name: string };
  }>;
};

type Preference = {
  id: string;
  shiftPreference: string | null;
  preferredDaysOff: string;
  notes: string | null;
  nurse: { name: string };
};

// Group merged configs by clinic for a compact table view
function groupByClinic(configs: MergedConfig[]) {
  const map = new Map<
    string,
    { clinicName: string; days: Map<string, MergedConfig> }
  >();
  for (const c of configs) {
    if (!map.has(c.clinicId)) {
      map.set(c.clinicId, { clinicName: c.clinicName, days: new Map() });
    }
    map.get(c.clinicId)!.days.set(c.day, c);
  }
  return Array.from(map.values());
}

// Permanent sentinel value
const PERMANENT_SENTINEL = "1970-01-01T00:00:00.000Z";

export function StepReviewConfig({
  weekStart,
  isGenerating,
  algorithmVersion,
  onAlgorithmChange,
  shiftBuilder,
  onShiftBuilderChange,
  onBack,
  onGenerate,
}: {
  weekStart: Date;
  isGenerating: boolean;
  algorithmVersion: AlgorithmVersion;
  onAlgorithmChange: (v: AlgorithmVersion) => void;
  shiftBuilder: ShiftBuilderMode;
  onShiftBuilderChange: (v: ShiftBuilderMode) => void;
  onBack: () => void;
  onGenerate: () => void;
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

  const [clinicConfigs, setClinicConfigs] = useState<MergedConfig[]>([]);
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [nurses, setNurses] = useState<NurseWithFixed[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const weekStr = formatDate(weekStart);

    Promise.all([
      fetch(`/api/clinics/config/${weekStr}`).then((r) =>
        r.ok ? r.json() : [],
      ),
      fetch("/api/requests/pending").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/nurses").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/preferences/week/${weekStr}`).then((r) =>
        r.ok ? r.json() : [],
      ),
    ])
      .then(([configs, offs, nurseData, prefs]) => {
        setClinicConfigs(configs);
        setTimeOffs(offs);
        setNurses(nurseData);
        setPreferences(prefs);
      })
      .finally(() => setLoading(false));
  }, [weekStart]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="me-2 text-muted-foreground">
          {t("loading_config")}
        </span>
      </div>
    );
  }

  const clinicGroups = groupByClinic(clinicConfigs.filter((c) => c.isActive));

  // Extract permanent fixed assignments from nurse data
  const fixedAssignments = nurses.flatMap((n) =>
    n.fixedAssignments
      .filter((fa) => fa.weekStart === PERMANENT_SENTINEL)
      .map((fa) => ({
        nurseName: n.user.name,
        clinicName: fa.clinic.name,
        day: fa.day,
      })),
  );

  return (
    <div className="space-y-6">
      {/* 1. Clinic Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("clinic_config")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("clinic_label")}</TableHead>
                <TableHead>{t("active_days")}</TableHead>
                <TableHead>{t("total_nurses_needed")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clinicGroups.map((group) => {
                const totalNurses = Array.from(group.days.values()).reduce(
                  (sum, d) => sum + d.nursesNeeded,
                  0,
                );
                return (
                  <TableRow key={group.clinicName}>
                    <TableCell className="font-medium">
                      {group.clinicName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {DAY_ORDER.map((day) => {
                          const config = group.days.get(day);
                          if (!config) return null;
                          return (
                            <Badge
                              key={day}
                              variant="outline"
                              className={
                                config.isOverride
                                  ? "border-blue-300 bg-blue-50"
                                  : ""
                              }
                            >
                              {DAY_LABELS[day]}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>{totalNurses}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 2. Time-offs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("pending_time_offs")}</CardTitle>
        </CardHeader>
        <CardContent>
          {timeOffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("no_pending_time_offs")}
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {timeOffs.map((timeOff) => (
                <li key={timeOff.id}>
                  <span className="font-medium">{timeOff.nurse.name}</span> —{" "}
                  {timeOff.type === "OFF_DAY" ? t("off_day") : timeOff.type} —{" "}
                  {timeOff.startDate.slice(0, 10)}
                  {timeOff.startDate !== timeOff.endDate &&
                    ` ${t("until_connector")} ${timeOff.endDate.slice(0, 10)}`}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 3. Fixed Assignments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("fixed_assignments")}</CardTitle>
        </CardHeader>
        <CardContent>
          {fixedAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_fixed")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {fixedAssignments.map((fa, i) => (
                <li key={i}>
                  <span className="font-medium">{fa.nurseName}</span> →{" "}
                  {fa.clinicName} ({DAY_LABELS[fa.day] ?? fa.day})
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 4. Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("nurse_preferences")}</CardTitle>
        </CardHeader>
        <CardContent>
          {preferences.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("no_preferences")}
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {preferences.map((p) => (
                <li key={p.id}>
                  <span className="font-medium">{p.nurse.name}</span>
                  {p.shiftPreference && ` — ${p.shiftPreference}`}
                  {p.preferredDaysOff &&
                    ` — ${t("days_off_colon")} ${p.preferredDaysOff}`}
                  {p.notes && ` — ${p.notes}`}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 5. Algorithm Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("algorithm_label")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={algorithmVersion}
            onValueChange={(v) => onAlgorithmChange(v as AlgorithmVersion)}
          >
            <SelectTrigger className="w-full max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALGORITHM_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex flex-col">
                    <span>{t(opt.labelKey)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            {algorithmVersion === "v1-clinic-first"
              ? t("algo_v1_desc")
              : t("algo_v2_desc")}
          </p>
        </CardContent>
      </Card>

      {/* 6. Shift Builder Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t("shift_builder_label")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={shiftBuilder === "on"}
              onClick={() =>
                onShiftBuilderChange(shiftBuilder === "on" ? "off" : "on")
              }
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                shiftBuilder === "on" ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform",
                  shiftBuilder === "on" ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
            <span className="text-sm">
              {shiftBuilder === "on"
                ? t("shift_builder_on")
                : t("shift_builder_off")}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("shift_builder_desc")}
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>
          → {t("back")}
        </Button>
        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin me-2" />
              {t("generating")}
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 me-2" />
              {t("generate_schedule")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
