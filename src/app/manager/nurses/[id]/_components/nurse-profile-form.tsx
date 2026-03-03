"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useTranslation } from "@/i18n/use-translation";
import { DAY_ORDER } from "@/lib/utils";
import type { SerializedNurse } from "@/types/nurse";

type Clinic = { id: string; name: string };

const PERMANENT_SENTINEL = "1970-01-01T00:00:00.000Z";

export function NurseProfileForm({
  nurse,
  allClinics,
}: {
  nurse: SerializedNurse;
  allClinics: Clinic[];
}) {
  const router = useRouter();
  const { t } = useTranslation();

  const SHIFT_OPTIONS = [
    { value: "MORNING", label: t("morning") },
    { value: "AFTERNOON", label: t("afternoon") },
    { value: "ANYTIME", label: t("anytime") },
  ] as const;

  const DAY_LABELS: Record<string, string> = {
    SUN: t("sun"),
    MON: t("mon"),
    TUE: t("tue"),
    WED: t("wed"),
    THU: t("thu"),
    FRI: t("fri"),
    SAT: t("sat"),
  };

  // ── Card 1: Profile state ──
  const [profileData, setProfileData] = useState({
    contractHours: nurse.contractHours,
    shiftPreference: nurse.shiftPreference,
    canWorkFriday: nurse.canWorkFriday,
    canWorkSaturday: nurse.canWorkSaturday,
    maxDaysPerWeek: nurse.maxDaysPerWeek,
    recurringOffDays: nurse.recurringOffDays ?? [],
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // ── Card 2: Blocked clinics state ──
  const blockedIds = new Set(nurse.blockedClinics.map((bc) => bc.clinicId));
  const [blockedSet, setBlockedSet] = useState<Set<string>>(blockedIds);
  const [blockedSaving, setBlockedSaving] = useState(false);

  // ── Card 3: Fixed assignments state ──
  const [fixedDialogOpen, setFixedDialogOpen] = useState(false);
  const [fixedClinicId, setFixedClinicId] = useState("");
  const [fixedDay, setFixedDay] = useState("");
  const [fixedPermanent, setFixedPermanent] = useState(true);
  const [fixedSaving, setFixedSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // ── Card 4: Dialogs ──
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);

  // ── Feedback ──
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

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
      showMessage(t("save_success"), "success");
    } catch {
      showMessage(t("save_error"), "error");
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
      showMessage(t("save_success"), "success");
    } catch {
      showMessage(t("save_error"), "error");
    } finally {
      setBlockedSaving(false);
    }
  }

  // ── Card 3: Add fixed assignment ──
  async function addFixedAssignment() {
    if (!fixedClinicId || !fixedDay) return;
    setFixedSaving(true);
    try {
      const body: Record<string, string> = {
        clinicId: fixedClinicId,
        day: fixedDay,
      };
      if (!fixedPermanent) {
        // Next Sunday (always at least 1 day ahead; if today is Sunday, target next week)
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
        const nextSunday = new Date(now);
        nextSunday.setDate(now.getDate() + daysUntilSunday);
        body.weekStart = nextSunday.toISOString().slice(0, 10);
      }
      const res = await fetch(`/api/nurses/${nurse.id}/fixed-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        showMessage(t("fixed_duplicate"), "error");
        return;
      }
      if (!res.ok) throw new Error();
      showMessage(t("fixed_added"), "success");
      setFixedDialogOpen(false);
      setFixedClinicId("");
      setFixedDay("");
      setFixedPermanent(true);
      router.refresh();
    } catch {
      showMessage(t("fixed_add_error"), "error");
    } finally {
      setFixedSaving(false);
    }
  }

  // ── Card 3: Remove fixed assignment ──
  async function removeFixedAssignment(assignmentId: string) {
    setRemovingId(assignmentId);
    try {
      const res = await fetch(
        `/api/nurses/${nurse.id}/fixed-assignments/${assignmentId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error();
      showMessage(t("fixed_removed"), "success");
      router.refresh();
    } catch {
      showMessage(t("fixed_remove_error"), "error");
    } finally {
      setRemovingId(null);
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
      showMessage(t("pin_updated"), "success");
      setPinDialogOpen(false);
      setNewPin("");
    } catch {
      showMessage(t("pin_update_error"), "error");
    }
  }

  // ── Card 4: Toggle active/inactive ──
  async function toggleNurseActive() {
    const newIsActive = !nurse.user.isActive;
    try {
      const res = await fetch(`/api/users/${nurse.user.id}/deactivate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newIsActive }),
      });
      if (!res.ok) throw new Error();
      showMessage(
        newIsActive ? t("nurse_reactivated") : t("nurse_deactivated"),
        "success",
      );
      setDeactivateDialogOpen(false);
      router.refresh();
    } catch {
      showMessage(t("deactivate_error"), "error");
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/manager/nurses")}
        >
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
          <CardTitle>{t("nurse_profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contract hours */}
          <div className="grid gap-2">
            <Label htmlFor="contractHours">{t("contract_hours")}</Label>
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
            <Label>{t("shift_preference")}</Label>
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
                  setProfileData((prev) => ({
                    ...prev,
                    canWorkFriday: checked,
                  }))
                }
              />
              <Label htmlFor="canWorkFriday">{t("can_work_friday")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="canWorkSaturday"
                checked={profileData.canWorkSaturday}
                onCheckedChange={(checked) =>
                  setProfileData((prev) => ({
                    ...prev,
                    canWorkSaturday: checked,
                  }))
                }
              />
              <Label htmlFor="canWorkSaturday">{t("can_work_saturday")}</Label>
            </div>
          </div>

          {/* Max days */}
          <div className="grid gap-2">
            <Label>{t("max_days_per_week")}</Label>
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
            <Label>{t("recurring_off_days")}</Label>
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
            {profileSaving ? t("saving") : t("save")}
          </Button>
        </CardContent>
      </Card>

      {/* ── Card 2: Blocked Clinics ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("blocked_clinics")}</CardTitle>
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
            {blockedSaving ? t("saving") : t("save")}
          </Button>
        </CardContent>
      </Card>

      {/* ── Card 3: Fixed Assignments ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("fixed_assignments")}</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFixedDialogOpen(true)}
          >
            <Plus className="h-4 w-4 me-1" />
            {t("add_fixed")}
          </Button>
        </CardHeader>
        <CardContent>
          {nurse.fixedAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_fixed")}</p>
          ) : (
            <div className="space-y-2">
              {nurse.fixedAssignments.map((fa) => (
                <div key={fa.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{fa.clinic.name}</span>
                  <span className="text-muted-foreground">
                    {DAY_LABELS[fa.day]}
                  </span>
                  <Badge variant="outline">
                    {fa.weekStart === PERMANENT_SENTINEL
                      ? t("permanent")
                      : new Date(fa.weekStart).toLocaleDateString("he-IL")}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    disabled={removingId === fa.id}
                    onClick={() => removeFixedAssignment(fa.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Card 4: Account Actions ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("account_actions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!nurse.user.isActive && (
            <div className="rounded-md bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
              {t("nurse_inactive_warning")}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setPinDialogOpen(true)}>
              {t("reset_pin")}
            </Button>
            <Button
              variant={nurse.user.isActive ? "destructive" : "default"}
              onClick={() => setDeactivateDialogOpen(true)}
            >
              {nurse.user.isActive ? t("deactivate") : t("reactivate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Reset PIN Dialog ── */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reset_pin")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="newPin">{t("new_pin_4_digits")}</Label>
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
              {t("cancel")}
            </Button>
            <Button onClick={resetPin} disabled={newPin.length !== 4}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Fixed Assignment Dialog ── */}
      <Dialog open={fixedDialogOpen} onOpenChange={setFixedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("add_fixed")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>{t("select_clinic")}</Label>
              <Select value={fixedClinicId} onValueChange={setFixedClinicId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("select_clinic")} />
                </SelectTrigger>
                <SelectContent>
                  {allClinics.map((clinic) => (
                    <SelectItem key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("select_day")}</Label>
              <Select value={fixedDay} onValueChange={setFixedDay}>
                <SelectTrigger>
                  <SelectValue placeholder={t("select_day")} />
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
            <div className="flex items-center gap-2">
              <Switch
                id="fixedPermanent"
                checked={fixedPermanent}
                onCheckedChange={setFixedPermanent}
              />
              <Label htmlFor="fixedPermanent">
                {fixedPermanent
                  ? t("permanent_assignment")
                  : t("one_week_only")}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixedDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={addFixedAssignment}
              disabled={!fixedClinicId || !fixedDay || fixedSaving}
            >
              {fixedSaving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate/Reactivate Dialog ── */}
      <Dialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {nurse.user.isActive
                ? t("deactivate_account")
                : t("reactivate_account")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {nurse.user.isActive
              ? `${t("deactivate_warning")} ${nurse.user.name}?`
              : `${t("reactivate_confirm")} ${nurse.user.name}?`}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateDialogOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant={nurse.user.isActive ? "destructive" : "default"}
              onClick={toggleNurseActive}
            >
              {nurse.user.isActive ? t("deactivate") : t("reactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
