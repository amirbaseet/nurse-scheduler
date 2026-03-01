"use client";

import { useEffect, useState } from "react";
import { Loader2, Info } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/i18n/use-translation";
import type { ClinicWithDefaults } from "@/types/clinic";

export function EditClinicDialog({
  clinic,
  onClose,
  onSaved,
}: {
  clinic: ClinicWithDefaults | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [genderPref, setGenderPref] = useState("ANY");
  const [canBeSecondary, setCanBeSecondary] = useState(false);
  const [secondaryHours, setSecondaryHours] = useState("0");
  const [secondaryNursesNeeded, setSecondaryNursesNeeded] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when clinic changes
  useEffect(() => {
    if (clinic) {
      setName(clinic.name);
      setNameAr(clinic.nameAr ?? "");
      setGenderPref(clinic.genderPref);
      setCanBeSecondary(clinic.canBeSecondary);
      setSecondaryHours(String(clinic.secondaryHours ?? 0));
      setSecondaryNursesNeeded(String(clinic.secondaryNursesNeeded ?? 0));
      setIsActive(clinic.isActive);
      setError(null);
    }
  }, [clinic]);

  async function handleSave() {
    if (!clinic || !name.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/clinics/${clinic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nameAr: nameAr.trim() || undefined,
          genderPref,
          canBeSecondary,
          secondaryHours: canBeSecondary
            ? parseFloat(secondaryHours) || 0
            : undefined,
          secondaryNursesNeeded: canBeSecondary
            ? parseInt(secondaryNursesNeeded, 10) || 0
            : undefined,
          isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? t("clinic_update_error"));
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clinic_update_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={clinic !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("edit_clinic")}</DialogTitle>
          <DialogDescription>{clinic?.name}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Clinic Code (read-only) */}
          <div className="grid gap-1.5">
            <Label>{t("clinic_code")}</Label>
            <Input value={clinic?.code ?? ""} disabled dir="ltr" />
          </div>

          {/* Name (Hebrew) */}
          <div className="grid gap-1.5">
            <Label>{t("name_hebrew")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* Name (Arabic) */}
          <div className="grid gap-1.5">
            <Label>{t("name_arabic")}</Label>
            <Input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder={t("name_arabic")}
            />
          </div>

          {/* Gender Preference */}
          <div className="grid gap-1.5">
            <Label>{t("gender_pref_label")}</Label>
            <Select value={genderPref} onValueChange={setGenderPref}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FEMALE_ONLY">{t("female_only")}</SelectItem>
                <SelectItem value="FEMALE_PREFERRED">
                  {t("female_preferred")}
                </SelectItem>
                <SelectItem value="ANY">{t("any_gender")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Can Be Secondary */}
          <div className="flex items-center justify-between">
            <Label>{t("can_be_secondary")}</Label>
            <Switch
              checked={canBeSecondary}
              onCheckedChange={setCanBeSecondary}
            />
          </div>

          {/* Secondary fields (conditional) */}
          {canBeSecondary && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("secondary_hours")}</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={secondaryHours}
                  onChange={(e) => setSecondaryHours(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("secondary_nurses_needed")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={secondaryNursesNeeded}
                  onChange={(e) => setSecondaryNursesNeeded(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* Is Active */}
          <div className="flex items-center justify-between">
            <Label>{t("active")}</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
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
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin me-2" />
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
