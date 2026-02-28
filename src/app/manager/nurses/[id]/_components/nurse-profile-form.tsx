"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { DAY_ORDER } from "@/lib/utils";
import { parseJsonArray } from "@/lib/json-arrays";
import type { SerializedNurse } from "@/types/nurse";

type Clinic = { id: string; name: string };

const SHIFT_OPTIONS = [
  { value: "MORNING", label: "בוקר" },
  { value: "AFTERNOON", label: "אחה״צ" },
  { value: "ANYTIME", label: "גמיש" },
] as const;

const DAY_LABELS: Record<string, string> = {
  SUN: "ראשון",
  MON: "שני",
  TUE: "שלישי",
  WED: "רביעי",
  THU: "חמישי",
  FRI: "שישי",
  SAT: "שבת",
};

const PERMANENT_SENTINEL = "1970-01-01T00:00:00.000Z";

export function NurseProfileForm({
  nurse,
  allClinics,
}: {
  nurse: SerializedNurse;
  allClinics: Clinic[];
}) {
  const router = useRouter();

  // ── Card 1: Profile state ──
  const [profileData, setProfileData] = useState({
    contractHours: nurse.contractHours,
    shiftPreference: nurse.shiftPreference,
    canWorkFriday: nurse.canWorkFriday,
    canWorkSaturday: nurse.canWorkSaturday,
    maxDaysPerWeek: nurse.maxDaysPerWeek,
    recurringOffDays: parseJsonArray(nurse.recurringOffDays),
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // ── Card 2: Blocked clinics state ──
  const blockedIds = new Set(nurse.blockedClinics.map((bc) => bc.clinicId));
  const [blockedSet, setBlockedSet] = useState<Set<string>>(blockedIds);
  const [blockedSaving, setBlockedSaving] = useState(false);

  // ── Card 4: Dialogs ──
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);

  // ── Feedback ──
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  function showMessage(text: string, type: "success" | "error") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  // ── Card 1: Save profile ──
  async function saveProfile() {
    setProfileSaving(true);
    try {
      const res = await fetch(`/api/nurses/${nurse.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractHours: profileData.contractHours,
          shiftPreference: profileData.shiftPreference,
          canWorkFriday: profileData.canWorkFriday,
          canWorkSaturday: profileData.canWorkSaturday,
          maxDaysPerWeek: profileData.maxDaysPerWeek,
          recurringOffDays: profileData.recurringOffDays,
        }),
      });
      if (!res.ok) throw new Error();
      showMessage("נשמר בהצלחה", "success");
    } catch {
      showMessage("שגיאה בשמירה", "error");
    } finally {
      setProfileSaving(false);
    }
  }

  // ── Card 2: Save blocked clinics ──
  async function saveBlockedClinics() {
    setBlockedSaving(true);
    try {
      const res = await fetch(`/api/nurses/${nurse.id}/blocked-clinics`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicIds: Array.from(blockedSet) }),
      });
      if (!res.ok) throw new Error();
      showMessage("נשמר בהצלחה", "success");
    } catch {
      showMessage("שגיאה בשמירה", "error");
    } finally {
      setBlockedSaving(false);
    }
  }

  // ── Card 4: Reset PIN ──
  async function resetPin() {
    if (!/^\d{4}$/.test(newPin)) return;
    try {
      const res = await fetch(`/api/users/${nurse.user.id}/pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin }),
      });
      if (!res.ok) throw new Error();
      showMessage("PIN עודכן", "success");
      setPinDialogOpen(false);
      setNewPin("");
    } catch {
      showMessage("שגיאה בעדכון PIN", "error");
    }
  }

  // ── Card 4: Deactivate ──
  async function deactivateNurse() {
    try {
      const res = await fetch(`/api/users/${nurse.user.id}/deactivate`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error();
      router.push("/manager/nurses");
    } catch {
      showMessage("שגיאה בהשבתה", "error");
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/manager/nurses")}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{nurse.user.name}</h1>
      </div>

      {/* Feedback toast */}
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

      {/* ── Card 1: Profile ── */}
      <Card>
        <CardHeader>
          <CardTitle>פרופיל אחות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contract hours */}
          <div className="grid gap-2">
            <Label htmlFor="contractHours">שעות חוזה</Label>
            <Input
              id="contractHours"
              type="number"
              min={1}
              max={45}
              step={0.5}
              value={profileData.contractHours}
              onChange={(e) =>
                setProfileData((prev) => ({
                  ...prev,
                  contractHours: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>

          {/* Shift preference */}
          <div className="grid gap-2">
            <Label>העדפת משמרת</Label>
            <Select
              value={profileData.shiftPreference}
              onValueChange={(val) =>
                setProfileData((prev) => ({
                  ...prev,
                  shiftPreference: val as "MORNING" | "AFTERNOON" | "ANYTIME",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Friday / Saturday switches */}
          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <Switch
                id="canWorkFriday"
                checked={profileData.canWorkFriday}
                onCheckedChange={(checked) =>
                  setProfileData((prev) => ({ ...prev, canWorkFriday: checked }))
                }
              />
              <Label htmlFor="canWorkFriday">עבודה בשישי</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="canWorkSaturday"
                checked={profileData.canWorkSaturday}
                onCheckedChange={(checked) =>
                  setProfileData((prev) => ({ ...prev, canWorkSaturday: checked }))
                }
              />
              <Label htmlFor="canWorkSaturday">עבודה בשבת</Label>
            </div>
          </div>

          {/* Max days */}
          <div className="grid gap-2">
            <Label>מקסימום ימים בשבוע</Label>
            <Select
              value={String(profileData.maxDaysPerWeek)}
              onValueChange={(val) =>
                setProfileData((prev) => ({
                  ...prev,
                  maxDaysPerWeek: parseInt(val, 10),
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recurring off days */}
          <div className="grid gap-2">
            <Label>ימי חופש קבועים</Label>
            <div className="flex flex-wrap gap-3">
              {DAY_ORDER.map((day) => (
                <div key={day} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`off-${day}`}
                    checked={profileData.recurringOffDays.includes(day)}
                    onCheckedChange={(checked) => {
                      setProfileData((prev) => ({
                        ...prev,
                        recurringOffDays: checked
                          ? [...prev.recurringOffDays, day]
                          : prev.recurringOffDays.filter((d) => d !== day),
                      }));
                    }}
                  />
                  <Label htmlFor={`off-${day}`} className="text-sm">
                    {DAY_LABELS[day]}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={saveProfile} disabled={profileSaving}>
            {profileSaving ? "שומר..." : "שמירה"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Card 2: Blocked Clinics ── */}
      <Card>
        <CardHeader>
          <CardTitle>מרפאות חסומות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {allClinics.map((clinic) => (
              <div key={clinic.id} className="flex items-center gap-1.5">
                <Checkbox
                  id={`blocked-${clinic.id}`}
                  checked={blockedSet.has(clinic.id)}
                  onCheckedChange={(checked) => {
                    setBlockedSet((prev) => {
                      const next = new Set(prev);
                      if (checked) {
                        next.add(clinic.id);
                      } else {
                        next.delete(clinic.id);
                      }
                      return next;
                    });
                  }}
                />
                <Label htmlFor={`blocked-${clinic.id}`} className="text-sm">
                  {clinic.name}
                </Label>
              </div>
            ))}
          </div>
          <Button onClick={saveBlockedClinics} disabled={blockedSaving}>
            {blockedSaving ? "שומר..." : "שמירה"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Card 3: Fixed Assignments (read-only) ── */}
      <Card>
        <CardHeader>
          <CardTitle>שיבוצים קבועים</CardTitle>
        </CardHeader>
        <CardContent>
          {nurse.fixedAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין שיבוצים קבועים</p>
          ) : (
            <div className="space-y-2">
              {nurse.fixedAssignments.map((fa) => (
                <div
                  key={fa.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="font-medium">{fa.clinic.name}</span>
                  <span className="text-muted-foreground">
                    {DAY_LABELS[fa.day]}
                  </span>
                  <Badge variant="outline">
                    {fa.weekStart === PERMANENT_SENTINEL
                      ? "קבוע"
                      : new Date(fa.weekStart).toLocaleDateString("he-IL")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Card 4: Account Actions ── */}
      <Card>
        <CardHeader>
          <CardTitle>פעולות חשבון</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline" onClick={() => setPinDialogOpen(true)}>
            איפוס PIN
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeactivateDialogOpen(true)}
          >
            השבתה
          </Button>
        </CardContent>
      </Card>

      {/* ── Reset PIN Dialog ── */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>איפוס PIN</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="newPin">PIN חדש (4 ספרות)</Label>
            <Input
              id="newPin"
              type="text"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              dir="ltr"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={resetPin} disabled={newPin.length !== 4}>
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate Dialog ── */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>השבתת חשבון</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            להשבית את חשבון {nurse.user.name}? לא ניתן לבטל פעולה זו.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>
              ביטול
            </Button>
            <Button variant="destructive" onClick={deactivateNurse}>
              השבתה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
