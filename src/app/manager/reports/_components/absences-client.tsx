"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  UserX,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/utils";

type AbsenceEntry = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  recordedByManager: boolean;
};

type NurseReport = {
  nurseId: string;
  nurseName: string;
  totalDays: number;
  byType: Record<string, number>;
  absences: AbsenceEntry[];
};

type ReportData = {
  month: string;
  report: NurseReport[];
};

const TYPE_ICONS: Record<string, string> = {
  VACATION: "🏖",
  SICK: "🤒",
  PERSONAL: "👤",
  OFF_DAY: "📅",
};

function formatMonthDisplay(yearMonth: string, locale: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(locale === "he" ? "he-IL" : "ar-SA", {
    year: "numeric",
    month: "long",
  });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function getInitialMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}`;
}

export function AbsencesClient() {
  const [month, setMonth] = useState(getInitialMonth);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedNurse, setExpandedNurse] = useState<string | null>(null);

  const { t, locale } = useTranslation();

  const TYPE_LABELS: Record<string, string> = {
    VACATION: t("type_vacation"),
    SICK: t("type_sick"),
    PERSONAL: t("type_personal"),
    OFF_DAY: t("type_off_day"),
  };

  const fetchReport = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/absences?month=${m}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch report:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(month);
  }, [month, fetchReport]);

  const totalAbsentDays =
    data?.report.reduce((sum, n) => sum + n.totalDays, 0) ?? 0;
  const totalByType: Record<string, number> = {};
  data?.report.forEach((n) => {
    for (const [type, days] of Object.entries(n.byType)) {
      totalByType[type] = (totalByType[type] ?? 0) + days;
    }
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("absence_report")}</h1>

      {/* Month picker */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-lg font-medium min-w-[160px] text-center">
          {formatMonthDisplay(month, locale)}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.report.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("no_absences")}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <CalendarDays className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-2xl font-bold">{totalAbsentDays}</div>
                <div className="text-xs text-muted-foreground">
                  {t("total_absent_days")}
                </div>
              </CardContent>
            </Card>
            {Object.entries(totalByType)
              .filter(([, days]) => days > 0)
              .map(([type, days]) => (
                <Card key={type}>
                  <CardContent className="p-4 text-center">
                    <span className="text-lg">{TYPE_ICONS[type]}</span>
                    <div className="text-2xl font-bold">{days}</div>
                    <div className="text-xs text-muted-foreground">
                      {TYPE_LABELS[type]}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Nurse table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-start p-3 font-medium">
                        {t("name")}
                      </th>
                      <th className="text-center p-3 font-medium">
                        {t("days_absent")}
                      </th>
                      <th className="text-center p-3 font-medium">
                        {TYPE_LABELS.VACATION}
                      </th>
                      <th className="text-center p-3 font-medium">
                        {TYPE_LABELS.SICK}
                      </th>
                      <th className="text-center p-3 font-medium">
                        {TYPE_LABELS.PERSONAL}
                      </th>
                      <th className="text-center p-3 font-medium">
                        {TYPE_LABELS.OFF_DAY}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.report.map((nurse) => (
                      <>
                        <tr
                          key={nurse.nurseId}
                          className={cn(
                            "border-b hover:bg-muted/30 cursor-pointer transition-colors",
                            nurse.totalDays === 0 && "opacity-50",
                          )}
                          onClick={() =>
                            setExpandedNurse(
                              expandedNurse === nurse.nurseId
                                ? null
                                : nurse.nurseId,
                            )
                          }
                        >
                          <td className="p-3 font-medium">
                            {nurse.nurseName}
                          </td>
                          <td className="p-3 text-center">
                            {nurse.totalDays > 0 ? (
                              <Badge variant="secondary">
                                {nurse.totalDays}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {nurse.byType.VACATION || "—"}
                          </td>
                          <td className="p-3 text-center">
                            {nurse.byType.SICK || "—"}
                          </td>
                          <td className="p-3 text-center">
                            {nurse.byType.PERSONAL || "—"}
                          </td>
                          <td className="p-3 text-center">
                            {nurse.byType.OFF_DAY || "—"}
                          </td>
                        </tr>

                        {/* Expanded row: individual absences */}
                        {expandedNurse === nurse.nurseId &&
                          nurse.absences.length > 0 && (
                            <tr key={`${nurse.nurseId}-detail`}>
                              <td colSpan={6} className="bg-muted/20 p-3">
                                <div className="space-y-2">
                                  {nurse.absences.map((abs) => (
                                    <div
                                      key={abs.id}
                                      className="flex items-center gap-3 text-xs"
                                    >
                                      <span>{TYPE_ICONS[abs.type]}</span>
                                      <span className="font-medium">
                                        {TYPE_LABELS[abs.type]}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {formatDateShort(abs.startDate)} —{" "}
                                        {formatDateShort(abs.endDate)}
                                      </span>
                                      <Badge variant="outline">
                                        {abs.days} {t("days")}
                                      </Badge>
                                      {abs.recordedByManager && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          {t("recorded_by_manager")}
                                        </Badge>
                                      )}
                                      {abs.reason && (
                                        <span className="text-muted-foreground">
                                          {abs.reason}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
