"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DAY_ORDER } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/use-translation";
import type { ClinicWithDefaults } from "@/types/clinic";

type DayConfig = {
  isActive: boolean;
  shiftStart: string;
  shiftEnd: string;
  nursesNeeded: number;
};

type ClinicState = Record<string, DayConfig>;

function buildClinicState(clinic: ClinicWithDefaults): ClinicState {
  const state: ClinicState = {};
  for (const day of DAY_ORDER) {
    const existing = clinic.defaultConfigs.find((c) => c.day === day);
    state[day] = existing
      ? {
          isActive: existing.isActive,
          shiftStart: existing.shiftStart,
          shiftEnd: existing.shiftEnd,
          nursesNeeded: existing.nursesNeeded,
        }
      : {
          isActive: false,
          shiftStart: "08:00",
          shiftEnd: "14:00",
          nursesNeeded: 1,
        };
  }
  return state;
}

export function DefaultScheduleTab({
  clinics,
}: {
  clinics: ClinicWithDefaults[];
}) {
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

  const GENDER_LABELS: Record<string, { label: string; variant: string }> = {
    FEMALE_ONLY: {
      label: t("female_only"),
      variant: "bg-pink-100 text-pink-800 border-pink-300",
    },
    FEMALE_PREFERRED: {
      label: t("female_preferred"),
      variant: "bg-purple-100 text-purple-800 border-purple-300",
    },
    ANY: {
      label: t("any_gender"),
      variant: "bg-gray-100 text-gray-800 border-gray-300",
    },
  };

  const [allStates, setAllStates] = useState<Record<string, ClinicState>>(
    () => {
      const initial: Record<string, ClinicState> = {};
      for (const clinic of clinics) {
        initial[clinic.id] = buildClinicState(clinic);
      }
      return initial;
    },
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  function updateDay(clinicId: string, day: string, patch: Partial<DayConfig>) {
    setAllStates((prev) => ({
      ...prev,
      [clinicId]: {
        ...prev[clinicId],
        [day]: { ...prev[clinicId][day], ...patch },
      },
    }));
  }

  async function saveClinic(clinicId: string) {
    setSavingId(clinicId);
    const state = allStates[clinicId];
    const configs = DAY_ORDER.map((day) => ({
      clinicId,
      day,
      shiftStart: state[day].shiftStart,
      shiftEnd: state[day].shiftEnd,
      nursesNeeded: state[day].nursesNeeded,
      isActive: state[day].isActive,
    }));

    try {
      const res = await fetch("/api/clinics/config/defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs }),
      });
      if (!res.ok) throw new Error();
      setMessage({ text: t("save_success"), type: "success" });
    } catch {
      setMessage({ text: t("save_error"), type: "error" });
    } finally {
      setSavingId(null);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  return (
    <div className="space-y-3 pt-4">
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

      {clinics.map((clinic) => {
        const gender = GENDER_LABELS[clinic.genderPref];
        return (
          <Collapsible key={clinic.id}>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between rounded-md border p-4 text-start hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{clinic.name}</span>
                  <Badge variant="outline" className={gender.variant}>
                    {gender.label}
                  </Badge>
                  {clinic.canBeSecondary && (
                    <Badge variant="outline">{t("secondary_clinic")}</Badge>
                  )}
                  {!clinic.isActive && (
                    <Badge
                      variant="outline"
                      className="bg-red-100 text-red-800 border-red-300"
                    >
                      {t("inactive")}
                    </Badge>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("day_label")}</TableHead>
                    <TableHead>{t("active")}</TableHead>
                    <TableHead>{t("shift_start")}</TableHead>
                    <TableHead>{t("shift_end")}</TableHead>
                    <TableHead>{t("nurses")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DAY_ORDER.map((day) => {
                    const config = allStates[clinic.id][day];
                    return (
                      <TableRow
                        key={day}
                        className={cn(!config.isActive && "opacity-50")}
                      >
                        <TableCell>{DAY_LABELS[day]}</TableCell>
                        <TableCell>
                          <Checkbox
                            checked={config.isActive}
                            onCheckedChange={(checked) =>
                              updateDay(clinic.id, day, {
                                isActive: checked === true,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="time"
                            value={config.shiftStart}
                            onChange={(e) =>
                              updateDay(clinic.id, day, {
                                shiftStart: e.target.value,
                              })
                            }
                            className="w-28"
                            dir="ltr"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="time"
                            value={config.shiftEnd}
                            onChange={(e) =>
                              updateDay(clinic.id, day, {
                                shiftEnd: e.target.value,
                              })
                            }
                            className="w-28"
                            dir="ltr"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            value={config.nursesNeeded}
                            onChange={(e) =>
                              updateDay(clinic.id, day, {
                                nursesNeeded: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="w-20"
                            dir="ltr"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-3">
                <Button
                  onClick={() => saveClinic(clinic.id)}
                  disabled={savingId === clinic.id}
                  size="sm"
                >
                  {savingId === clinic.id ? t("saving") : t("save_defaults")}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
