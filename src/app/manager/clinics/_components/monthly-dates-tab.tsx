"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/i18n/use-translation";
import type { ClinicWithDefaults } from "@/types/clinic";

type MonthlyDate = {
  id: string;
  clinicId: string;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  nursesNeeded: number;
  isActive: boolean;
};

type PendingDate = {
  date: string; // YYYY-MM-DD
  shiftStart: string;
  shiftEnd: string;
  nursesNeeded: number;
  isActive: boolean;
};

export function MonthlyDatesTab({
  clinics,
}: {
  clinics: ClinicWithDefaults[];
}) {
  const { t } = useTranslation();
  const [selectedClinicId, setSelectedClinicId] = useState(
    clinics[0]?.id ?? "",
  );
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [savedDates, setSavedDates] = useState<MonthlyDate[]>([]);
  const [pendingDates, setPendingDates] = useState<Map<string, PendingDate>>(
    new Map(),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  function showMessage(text: string, type: "success" | "error") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  const fetchDates = useCallback(async () => {
    if (!selectedClinicId) return;
    try {
      const res = await fetch(
        `/api/clinics/${selectedClinicId}/monthly-dates?month=${month}`,
      );
      if (res.ok) {
        const data: MonthlyDate[] = await res.json();
        setSavedDates(data);
        // Pre-populate pending from saved
        const map = new Map<string, PendingDate>();
        for (const d of data) {
          const dateStr = d.date.slice(0, 10);
          map.set(dateStr, {
            date: dateStr,
            shiftStart: d.shiftStart,
            shiftEnd: d.shiftEnd,
            nursesNeeded: d.nursesNeeded,
            isActive: d.isActive,
          });
        }
        setPendingDates(map);
      }
    } catch {
      showMessage(t("monthly_dates_save_error"), "error");
    }
  }, [selectedClinicId, month]);

  useEffect(() => {
    fetchDates();
  }, [fetchDates]);

  // Build calendar grid for the month
  const [yearNum, monthNum] = month.split("-").map(Number);
  const firstDay = new Date(yearNum, monthNum - 1, 1);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const startDow = firstDay.getDay(); // 0=SUN

  function toggleDate(day: number) {
    const dateStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setPendingDates((prev) => {
      const next = new Map(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.set(dateStr, {
          date: dateStr,
          shiftStart: "08:00",
          shiftEnd: "16:00",
          nursesNeeded: 1,
          isActive: true,
        });
      }
      return next;
    });
  }

  function updatePending(
    dateStr: string,
    field: string,
    value: string | number,
  ) {
    setPendingDates((prev) => {
      const next = new Map(prev);
      const entry = next.get(dateStr);
      if (entry) {
        next.set(dateStr, { ...entry, [field]: value });
      }
      return next;
    });
  }

  async function saveDates() {
    if (pendingDates.size === 0) return;
    setSaving(true);
    try {
      const dates = Array.from(pendingDates.values());

      // Find saved dates that were toggled off (need to be deleted)
      const pendingDateStrs = new Set(pendingDates.keys());
      const deleteIds = savedDates
        .filter((saved) => !pendingDateStrs.has(saved.date.slice(0, 10)))
        .map((saved) => saved.id);

      const res = await fetch(
        `/api/clinics/${selectedClinicId}/monthly-dates`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dates, deleteIds }),
        },
      );
      if (!res.ok) throw new Error();
      showMessage(t("monthly_dates_saved"), "success");
      await fetchDates();
    } catch {
      showMessage(t("monthly_dates_save_error"), "error");
    } finally {
      setSaving(false);
    }
  }

  function prevMonth() {
    const d = new Date(yearNum, monthNum - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function nextMonth() {
    const d = new Date(yearNum, monthNum, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const dayLabels = [
    t("sun"),
    t("mon"),
    t("tue"),
    t("wed"),
    t("thu"),
    t("fri"),
    t("sat"),
  ];

  const monthLabel = firstDay.toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
  });

  const selectedClinic = clinics.find((c) => c.id === selectedClinicId);

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Clinic selector */}
      <div className="grid gap-2 max-w-xs">
        <Label>{t("select_clinic")}</Label>
        <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {clinics.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedClinic && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedClinic.name} — {t("monthly_dates")}
              </CardTitle>
              <Badge variant="outline">
                {pendingDates.size} {t("add_dates")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Month navigator */}
            <div className="flex items-center justify-center gap-4">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-lg font-medium min-w-[160px] text-center">
                {monthLabel}
              </span>
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              {t("click_dates_to_toggle")}
            </p>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {dayLabels.map((label) => (
                <div
                  key={label}
                  className="text-center text-xs font-medium text-muted-foreground py-1"
                >
                  {label}
                </div>
              ))}

              {/* Empty cells before first day */}
              {Array.from({ length: startDow }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSelected = pendingDates.has(dateStr);

                return (
                  <button
                    key={day}
                    onClick={() => toggleDate(day)}
                    className={`
                      h-10 rounded-md text-sm font-medium transition-colors
                      ${
                        isSelected
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-muted hover:bg-muted/80"
                      }
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Selected dates config */}
            {pendingDates.size > 0 && (
              <div className="space-y-2 border-t pt-4">
                {Array.from(pendingDates.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dateStr, entry]) => (
                    <div
                      key={dateStr}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="font-medium min-w-[90px]" dir="ltr">
                        {new Date(dateStr + "T00:00:00").toLocaleDateString(
                          "he-IL",
                          { day: "numeric", month: "short" },
                        )}
                      </span>
                      <Input
                        type="time"
                        value={entry.shiftStart}
                        onChange={(e) =>
                          updatePending(dateStr, "shiftStart", e.target.value)
                        }
                        className="w-24"
                        dir="ltr"
                      />
                      <span>—</span>
                      <Input
                        type="time"
                        value={entry.shiftEnd}
                        onChange={(e) =>
                          updatePending(dateStr, "shiftEnd", e.target.value)
                        }
                        className="w-24"
                        dir="ltr"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={entry.nursesNeeded}
                        onChange={(e) =>
                          updatePending(
                            dateStr,
                            "nursesNeeded",
                            (() => {
                              const v = parseInt(e.target.value, 10);
                              return isNaN(v) ? 1 : v;
                            })(),
                          )
                        }
                        className="w-16"
                        dir="ltr"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() =>
                          toggleDate(parseInt(dateStr.split("-")[2], 10))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            )}

            <Button onClick={saveDates} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
