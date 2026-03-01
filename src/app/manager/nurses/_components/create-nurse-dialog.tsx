"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/i18n/use-translation";

export function CreateNurseDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [pin, setPin] = useState("");
  const [gender, setGender] = useState("FEMALE");
  const [contractHours, setContractHours] = useState("42");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setNameAr("");
    setPin("");
    setGender("FEMALE");
    setContractHours("42");
    setPhone("");
    setError(null);
  }

  async function handleSave() {
    if (!name.trim() || !pin.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nameAr: nameAr.trim() || undefined,
          role: "NURSE",
          pin,
          gender,
          contractHours: parseFloat(contractHours),
          phone: phone.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? t("nurse_create_error"));
      }

      resetForm();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("nurse_create_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("add_nurse")}</DialogTitle>
          <DialogDescription>{t("add_nurse")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Name (Hebrew) */}
          <div className="grid gap-1.5">
            <Label>{t("name_hebrew")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("name_hebrew")}
            />
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

          {/* PIN */}
          <div className="grid gap-1.5">
            <Label>{t("pin_label")}</Label>
            <Input
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                setPin(v);
              }}
              inputMode="numeric"
              maxLength={4}
              dir="ltr"
              placeholder="••••"
            />
          </div>

          {/* Gender + Contract Hours */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("gender_label")}</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FEMALE">{t("gender_female")}</SelectItem>
                  <SelectItem value="MALE">{t("gender_male")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("contract_hours")}</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={contractHours}
                onChange={(e) => setContractHours(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="grid gap-1.5">
            <Label>{t("phone_label")}</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              placeholder="050-000-0000"
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
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={saving}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || pin.length !== 4}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin me-2" />
                {t("saving")}
              </>
            ) : (
              t("create")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
