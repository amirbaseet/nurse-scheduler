"use client";

import { useEffect, useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, DAY_ORDER } from "@/lib/utils";
import type { MergedConfig } from "@/types/clinic";

const DAY_LABELS: Record<string, string> = {
  SUN: "א׳",
  MON: "ב׳",
  TUE: "ג׳",
  WED: "ד׳",
  THU: "ה׳",
  FRI: "ו׳",
  SAT: "ש׳",
};

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
  onBack,
  onGenerate,
}: {
  weekStart: Date;
  isGenerating: boolean;
  onBack: () => void;
  onGenerate: () => void;
}) {
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
        <span className="me-2 text-muted-foreground">טוען הגדרות...</span>
      </div>
    );
  }

  const clinicGroups = groupByClinic(
    clinicConfigs.filter((c) => c.isActive),
  );

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
          <CardTitle className="text-base">הגדרות מרפאות</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מרפאה</TableHead>
                <TableHead>ימים פעילים</TableHead>
                <TableHead>סה״כ אחיות</TableHead>
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
          <CardTitle className="text-base">בקשות חופשה ממתינות</CardTitle>
        </CardHeader>
        <CardContent>
          {timeOffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              אין בקשות חופשה ממתינות
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {timeOffs.map((t) => (
                <li key={t.id}>
                  <span className="font-medium">{t.nurse.name}</span> —{" "}
                  {t.type === "OFF_DAY" ? "יום חופש" : t.type} —{" "}
                  {t.startDate.slice(0, 10)}
                  {t.startDate !== t.endDate && ` עד ${t.endDate.slice(0, 10)}`}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 3. Fixed Assignments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">שיבוצים קבועים</CardTitle>
        </CardHeader>
        <CardContent>
          {fixedAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              אין שיבוצים קבועים
            </p>
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
          <CardTitle className="text-base">העדפות אחיות</CardTitle>
        </CardHeader>
        <CardContent>
          {preferences.length === 0 ? (
            <p className="text-sm text-muted-foreground">לא הוגשו העדפות</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {preferences.map((p) => (
                <li key={p.id}>
                  <span className="font-medium">{p.nurse.name}</span>
                  {p.shiftPreference && ` — ${p.shiftPreference}`}
                  {p.preferredDaysOff && ` — ימי חופש: ${p.preferredDaysOff}`}
                  {p.notes && ` — ${p.notes}`}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>
          → חזרה
        </Button>
        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin me-2" />
              מייצר לו״ז...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 me-2" />
              יצירת לו״ז
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
