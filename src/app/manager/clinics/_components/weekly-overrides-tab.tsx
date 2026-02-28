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
import type { MergedConfig } from "@/types/clinic";
import type { ClinicWithDefaults } from "@/types/clinic";

const DAY_LABELS: Record<string, string> = {
  SUN: "ראשון",
  MON: "שני",
  TUE: "שלישי",
  WED: "רביעי",
  THU: "חמישי",
  FRI: "שישי",
  SAT: "שבת",
};

export function WeeklyOverridesTab({
  clinics,
}: {
  clinics: ClinicWithDefaults[];
}) {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart());
  const [configs, setConfigs] = useState<MergedConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

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
      setMessage({ text: "הועתק בהצלחה", type: "success" });
      fetchConfigs();
    } catch {
      setMessage({ text: "שגיאה בהעתקה", type: "error" });
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
      setMessage({ text: "נשמר בהצלחה", type: "success" });
      fetchConfigs();
    } catch {
      setMessage({ text: "שגיאה בשמירה", type: "error" });
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
            העתקה משבוע קודם
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="me-1 h-4 w-4" />
            הוספת שינוי
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
        <p className="text-sm text-muted-foreground">טוען...</p>
      ) : overrides.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          אין שינויים לשבוע זה
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>מרפאה</TableHead>
              <TableHead>יום</TableHead>
              <TableHead>התחלה</TableHead>
              <TableHead>סיום</TableHead>
              <TableHead>אחיות</TableHead>
              <TableHead>פעיל</TableHead>
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
                    {config.isActive ? "פעיל" : "מושבת"}
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
            <DialogTitle>הוספת שינוי שבועי</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>מרפאה</Label>
              <Select
                value={newOverride.clinicId}
                onValueChange={(val) =>
                  setNewOverride((prev) => ({ ...prev, clinicId: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחירת מרפאה" />
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
              <Label>יום</Label>
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
                <Label>התחלה</Label>
                <Input
                  type="time"
                  value={newOverride.shiftStart}
                  onChange={(e) =>
                    setNewOverride((prev) => ({ ...prev, shiftStart: e.target.value }))
                  }
                  dir="ltr"
                />
              </div>
              <div className="grid gap-2">
                <Label>סיום</Label>
                <Input
                  type="time"
                  value={newOverride.shiftEnd}
                  onChange={(e) =>
                    setNewOverride((prev) => ({ ...prev, shiftEnd: e.target.value }))
                  }
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>מספר אחיות</Label>
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
                  setNewOverride((prev) => ({ ...prev, isActive: checked === true }))
                }
              />
              <Label htmlFor="overrideActive">פעיל</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={addOverride} disabled={!newOverride.clinicId}>
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
