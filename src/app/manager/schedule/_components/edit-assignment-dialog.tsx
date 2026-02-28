"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScheduleAssignment } from "@/types/schedule";

type NurseOption = {
  id: string;
  name: string;
};

type ClinicOption = {
  id: string;
  name: string;
};

export function EditAssignmentDialog({
  assignment,
  scheduleId,
  nurses,
  clinics,
  onClose,
  onSaved,
}: {
  assignment: ScheduleAssignment | null;
  scheduleId: string | null;
  nurses: NurseOption[];
  clinics: ClinicOption[];
  onClose: () => void;
  onSaved: (updated: ScheduleAssignment) => void;
}) {
  const [nurseId, setNurseId] = useState("");
  const [primaryClinicId, setPrimaryClinicId] = useState("");
  const [secondaryClinicId, setSecondaryClinicId] = useState("");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when assignment changes
  useEffect(() => {
    if (assignment) {
      setNurseId(assignment.nurseId);
      setPrimaryClinicId(assignment.primaryClinicId ?? "");
      setSecondaryClinicId(assignment.secondaryClinicId ?? "");
      setShiftStart(assignment.shiftStart ?? "");
      setShiftEnd(assignment.shiftEnd ?? "");
      setNotes(assignment.notes ?? "");
      setError(null);
    }
  }, [assignment]);

  const isFixed = assignment?.isFixed ?? false;
  const isOpen = assignment !== null;

  const handleSave = async () => {
    if (!assignment || !scheduleId) return;
    setSaving(true);
    setError(null);

    // Build payload with only changed fields
    const payload: Record<string, string | null | undefined> = {
      assignmentId: assignment.id,
    };

    if (!isFixed) {
      if (nurseId !== assignment.nurseId) payload.nurseId = nurseId;
      if (primaryClinicId !== (assignment.primaryClinicId ?? ""))
        payload.primaryClinicId = primaryClinicId || undefined;
      if (secondaryClinicId !== (assignment.secondaryClinicId ?? ""))
        payload.secondaryClinicId = secondaryClinicId || null;
      if (shiftStart !== (assignment.shiftStart ?? ""))
        payload.shiftStart = shiftStart || undefined;
      if (shiftEnd !== (assignment.shiftEnd ?? ""))
        payload.shiftEnd = shiftEnd || undefined;
    }
    if (notes !== (assignment.notes ?? "")) payload.notes = notes || undefined;

    try {
      const res = await fetch(`/api/schedule/${scheduleId}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "שגיאה בעדכון שיבוץ");
      }

      const updated = await res.json();

      // Merge with existing assignment data for full shape
      onSaved({
        ...assignment,
        ...updated,
        nurse: updated.nurse
          ? { id: updated.nurse.id, user: updated.nurse.user ?? assignment.nurse.user }
          : assignment.nurse,
        primaryClinic: updated.primaryClinic ?? assignment.primaryClinic,
        secondaryClinic: updated.secondaryClinic ?? assignment.secondaryClinic,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בעדכון שיבוץ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>עריכת שיבוץ</DialogTitle>
          <DialogDescription>
            {assignment?.nurse.user.name} — {assignment?.day}
          </DialogDescription>
        </DialogHeader>

        {/* Fixed assignment banner */}
        {isFixed && (
          <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <Lock className="h-4 w-4 shrink-0" />
            <span>שיבוץ קבוע — לא ניתן לשנות</span>
          </div>
        )}

        <div className="grid gap-4 py-2">
          {/* Nurse */}
          <div className="grid gap-1.5">
            <Label>אחות</Label>
            <Select
              value={nurseId}
              onValueChange={setNurseId}
              disabled={isFixed}
            >
              <SelectTrigger>
                <SelectValue />
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

          {/* Primary Clinic */}
          <div className="grid gap-1.5">
            <Label>מרפאה ראשית</Label>
            <Select
              value={primaryClinicId}
              onValueChange={setPrimaryClinicId}
              disabled={isFixed}
            >
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

          {/* Secondary Clinic */}
          <div className="grid gap-1.5">
            <Label>מרפאה משנית</Label>
            <Select
              value={secondaryClinicId || "__none__"}
              onValueChange={(v) =>
                setSecondaryClinicId(v === "__none__" ? "" : v)
              }
              disabled={isFixed}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא</SelectItem>
                {clinics.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shift times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>תחילת משמרת</Label>
              <Input
                type="time"
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
                disabled={isFixed}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>סוף משמרת</Label>
              <Input
                type="time"
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
                disabled={isFixed}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label>הערות</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערה לשיבוץ..."
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <Info className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin me-2" />
                שומר...
              </>
            ) : (
              "שמירה"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
