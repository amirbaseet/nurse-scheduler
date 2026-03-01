"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Copy } from "lucide-react";
import { subWeeks } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WeekNavigator } from "@/components/week-navigator";
import { getWeekStart, formatDate, DAY_ORDER } from "@/lib/utils";
import { useTranslation } from "@/i18n/use-translation";
import type { MergedConfig } from "@/types/clinic";
import type { ClinicWithDefaults } from "@/types/clinic";

export function WeeklyOverridesTab({
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

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart());
  const [configs, setConfigs] = useState<MergedConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Add override dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOverride, setNewOverride] = useState({
    clinicId: "",
    day: "SUN" as string,
    shiftStart: "08:00",
    shiftEnd: "14:00",
    nursesNeeded: 1,
    isActive: true,
  });

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clinics/config/${formatDate(weekStart)}`);
      if (!res.ok) throw new Error();
      const data: MergedConfig[] = await res.json();
      setConfigs(data);
    } catch {
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const overrides = configs.filter((c) => c.isOverride);

  async function copyPreviousWeek() {
    const prevWeek = subWeeks(weekStart, 1);
    try {
      const res = await fetch("/api/clinics/config/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWeek: formatDate(prevWeek),
          toWeek: formatDate(weekStart),
        }),
      });
      if (!res.ok) throw new Error();
      setMessage({ text: t("copy_success"), type: "success" });
      fetchConfigs();
    } catch {
      setMessage({ text: t("copy_error"), type: "error" });
    } finally {
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function addOverride() {
    if (!newOverride.clinicId) return;
    try {
      const res = await fetch(`/api/clinics/config/${formatDate(weekStart)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configs: [
            {
              clinicId: newOverride.clinicId,
              day: newOverride.day,
              shiftStart: newOverride.shiftStart,
              shiftEnd: newOverride.shiftEnd,
              nursesNeeded: newOverride.nursesNeeded,
              isActive: newOverride.isActive,
            },
          ],
        }),
      });
      if (!res.ok) throw new Error();
      setDialogOpen(false);
      setNewOverride({
        clinicId: "",
        day: "SUN",
        shiftStart: "08:00",
        shiftEnd: "14:00",
        nursesNeeded: 1,
        isActive: true,
      });
      setMessage({ text: t("save_success"), type: "success" });
      fetchConfigs();
    } catch {
      setMessage({ text: t("save_error"), type: "error" });
    } finally {
      setTimeout(() => setMessage(null), 3000);
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <WeekNavigator weekStart={weekStart} onWeekChange={setWeekStart} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyPreviousWeek}>
            <Copy className="me-1 h-4 w-4" />
            {t("copy_previous_week")}
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="me-1 h-4 w-4" />
            {t("add_override")}
          </Button>
        </div>
      </div>

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

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : overrides.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          {t("no_overrides")}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("clinic_label")}</TableHead>
              <TableHead>{t("day_label")}</TableHead>
              <TableHead>{t("shift_start")}</TableHead>
              <TableHead>{t("shift_end")}</TableHead>
              <TableHead>{t("nurses")}</TableHead>
              <TableHead>{t("active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overrides.map((config) => (
              <TableRow key={`${config.clinicId}-${config.day}`}>
                <TableCell className="font-medium">
                  {config.clinicName}
                </TableCell>
                <TableCell>{DAY_LABELS[config.day]}</TableCell>
                <TableCell dir="ltr">{config.shiftStart}</TableCell>
                <TableCell dir="ltr">{config.shiftEnd}</TableCell>
                <TableCell>{config.nursesNeeded}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      config.isActive
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-red-100 text-red-800 border-red-300"
                    }
                  >
                    {config.isActive ? t("active") : t("disabled_status")}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add Override Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("add_override")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>{t("clinic_label")}</Label>
              <Select
                value={newOverride.clinicId}
                onValueChange={(val) =>
                  setNewOverride((prev) => ({ ...prev, clinicId: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("select_clinic")} />
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

            <div className="grid gap-2">
              <Label>{t("day_label")}</Label>
              <Select
                value={newOverride.day}
                onValueChange={(val) =>
                  setNewOverride((prev) => ({ ...prev, day: val }))
                }
              >
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

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("shift_start")}</Label>
                <Input
                  type="time"
                  value={newOverride.shiftStart}
                  onChange={(e) =>
                    setNewOverride((prev) => ({
                      ...prev,
                      shiftStart: e.target.value,
                    }))
                  }
                  dir="ltr"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("shift_end")}</Label>
                <Input
                  type="time"
                  value={newOverride.shiftEnd}
                  onChange={(e) =>
                    setNewOverride((prev) => ({
                      ...prev,
                      shiftEnd: e.target.value,
                    }))
                  }
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>{t("nurses_needed")}</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={newOverride.nursesNeeded}
                onChange={(e) =>
                  setNewOverride((prev) => ({
                    ...prev,
                    nursesNeeded: parseInt(e.target.value, 10) || 0,
                  }))
                }
                dir="ltr"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="overrideActive"
                checked={newOverride.isActive}
                onCheckedChange={(checked) =>
                  setNewOverride((prev) => ({
                    ...prev,
                    isActive: checked === true,
                  }))
                }
              />
              <Label htmlFor="overrideActive">{t("active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={addOverride} disabled={!newOverride.clinicId}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
