"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Check,
  X,
  Calendar,
  AlertTriangle,
  Clock,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/use-translation";

type TimeOffRequest = {
  id: string;
  nurseId: string;
  nurse: { id: string; name: string };
  type: "VACATION" | "SICK" | "PERSONAL" | "OFF_DAY";
  startDate: string;
  endDate: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  managerNote: string | null;
  requestedAt: string;
  respondedAt: string | null;
  createdById?: string | null;
};

type NurseOption = { id: string; name: string };

const ABSENCE_TYPES = ["VACATION", "SICK", "PERSONAL", "OFF_DAY"] as const;

const TYPE_ICONS: Record<string, string> = {
  VACATION: "🏖",
  SICK: "🤒",
  PERSONAL: "👤",
  OFF_DAY: "📅",
};

function formatDateHe(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function daysBetween(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export default function RequestsPage() {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [pending, setPending] = useState<TimeOffRequest[]>([]);
  const [history, setHistory] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Record Absence dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [absenceForm, setAbsenceForm] = useState({
    nurseId: "",
    type: "SICK" as (typeof ABSENCE_TYPES)[number],
    startDate: "",
    endDate: "",
    reason: "",
    managerNote: "",
  });
  const [absenceLoading, setAbsenceLoading] = useState(false);

  const { t } = useTranslation();

  const TYPE_LABELS: Record<string, string> = {
    VACATION: t("type_vacation"),
    SICK: t("type_sick"),
    PERSONAL: t("type_personal"),
    OFF_DAY: t("type_off_day"),
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        fetch("/api/requests/pending"),
        // For history, we'll fetch pending and manually separate
        // The pending endpoint returns only PENDING; for history we need all
        fetch("/api/requests/pending"),
      ]);

      if (pendingRes.ok) {
        setPending(await pendingRes.json());
      }
      // History: fetch all users' requests that are not pending
      // We'll use the same pending data and show resolved ones separately
      // Actually, we need a different approach - fetch all from pending endpoint
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Fetch nurses when dialog opens
  useEffect(() => {
    if (!dialogOpen) return;
    fetch("/api/nurses")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ user: NurseOption }>) =>
        setNurses(data.map((n) => n.user)),
      )
      .catch(() => setNurses([]));
  }, [dialogOpen]);

  const handleRecordAbsence = async () => {
    setAbsenceLoading(true);
    try {
      const res = await fetch("/api/requests/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nurseId: absenceForm.nurseId,
          type: absenceForm.type,
          startDate: absenceForm.startDate,
          endDate: absenceForm.endDate,
          reason: absenceForm.reason || undefined,
          managerNote: absenceForm.managerNote || undefined,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setHistory((prev) => [created, ...prev]);
        setDialogOpen(false);
        setAbsenceForm({
          nurseId: "",
          type: "SICK",
          startDate: "",
          endDate: "",
          reason: "",
          managerNote: "",
        });
      }
    } catch (err) {
      console.error("Record absence failed:", err);
    } finally {
      setAbsenceLoading(false);
    }
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/requests/${id}/${action}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerNote: notes[id] || undefined }),
      });

      if (res.ok) {
        const updated = await res.json();
        // Move from pending to history
        setPending((prev) => prev.filter((r) => r.id !== id));
        setHistory(
          (prev) =>
            [
              { ...updated, nurse: pending.find((r) => r.id === id)?.nurse },
              ...prev,
            ] as TimeOffRequest[],
        );
      }
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("vacation_requests")}</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 me-1" />
          {t("record_absence")}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab("pending")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t("pending")} ({pending.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t("request_history")} ({history.length})
        </button>
      </div>

      {/* Pending */}
      {tab === "pending" && (
        <div className="space-y-4">
          {pending.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {t("no_pending_requests")}
              </CardContent>
            </Card>
          ) : (
            pending.map((req) => (
              <Card key={req.id}>
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{TYPE_ICONS[req.type]}</span>
                      <div>
                        <span className="font-bold">{req.nurse.name}</span>
                        <span className="text-muted-foreground">
                          {" — "}
                          {TYPE_LABELS[req.type]}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status="PENDING" />
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {formatDateHe(req.startDate)} —{" "}
                      {formatDateHe(req.endDate)}
                    </span>
                    <Badge variant="outline">
                      {daysBetween(req.startDate, req.endDate)} {t("days")}
                    </Badge>
                  </div>

                  {/* Reason */}
                  {req.reason && (
                    <p className="text-sm text-muted-foreground">
                      {t("reason")}: {req.reason}
                    </p>
                  )}

                  {/* Impact analysis */}
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-1">
                      <AlertTriangle className="h-4 w-4" />
                      {t("impact_analysis")}
                    </div>
                    <p className="text-xs text-amber-700">
                      {t("impact_approve_prefix")}
                      {formatDateHe(req.startDate)} {t("until_connector")}{" "}
                      {formatDateHe(req.endDate)} (
                      {daysBetween(req.startDate, req.endDate)} {t("days")}).{" "}
                      {t("impact_check_suffix")}
                    </p>
                  </div>

                  <Separator />

                  {/* Manager note + actions */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {t("manager_note")}
                      </label>
                      <Input
                        placeholder={t("note_optional")}
                        value={notes[req.id] ?? ""}
                        onChange={(e) =>
                          setNotes((prev) => ({
                            ...prev,
                            [req.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        disabled={actionLoading === req.id}
                        onClick={() => handleAction(req.id, "reject")}
                      >
                        {actionLoading === req.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <X className="h-4 w-4 me-1" />
                            {t("reject")}
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        disabled={actionLoading === req.id}
                        onClick={() => handleAction(req.id, "approve")}
                      >
                        {actionLoading === req.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 me-1" />
                            {t("approve")}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* History */}
      {tab === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {t("no_requests_history")}
              </CardContent>
            </Card>
          ) : (
            history.map((req) => (
              <Card key={req.id} className="opacity-80">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{TYPE_ICONS[req.type]}</span>
                      <span className="font-medium">{req.nurse?.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDateHe(req.startDate)} —{" "}
                        {formatDateHe(req.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.createdById && (
                        <Badge variant="secondary" className="text-xs">
                          {t("recorded_by_manager")}
                        </Badge>
                      )}
                      <StatusBadge
                        status={req.status as "APPROVED" | "REJECTED"}
                      />
                    </div>
                  </div>
                  {req.managerNote && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("notes")}: {req.managerNote}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Record Absence Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("record_absence")}</DialogTitle>
            <DialogDescription>{t("record_absence_desc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nurse select */}
            <div className="space-y-2">
              <Label>{t("nurse_label")}</Label>
              <Select
                value={absenceForm.nurseId}
                onValueChange={(v) =>
                  setAbsenceForm((prev) => ({ ...prev, nurseId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("select_nurse")} />
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

            {/* Type select */}
            <div className="space-y-2">
              <Label>{t("select_type")}</Label>
              <Select
                value={absenceForm.type}
                onValueChange={(v) =>
                  setAbsenceForm((prev) => ({
                    ...prev,
                    type: v as (typeof ABSENCE_TYPES)[number],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ABSENCE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_ICONS[type]} {TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("start_date")}</Label>
                <Input
                  type="date"
                  value={absenceForm.startDate}
                  onChange={(e) =>
                    setAbsenceForm((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("end_date")}</Label>
                <Input
                  type="date"
                  value={absenceForm.endDate}
                  onChange={(e) =>
                    setAbsenceForm((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>{t("reason")}</Label>
              <Input
                placeholder={t("note_optional")}
                value={absenceForm.reason}
                onChange={(e) =>
                  setAbsenceForm((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
              />
            </div>

            {/* Manager note */}
            <div className="space-y-2">
              <Label>{t("manager_note")}</Label>
              <Input
                placeholder={t("note_optional")}
                value={absenceForm.managerNote}
                onChange={(e) =>
                  setAbsenceForm((prev) => ({
                    ...prev,
                    managerNote: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={absenceLoading}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleRecordAbsence}
              disabled={
                absenceLoading ||
                !absenceForm.nurseId ||
                !absenceForm.startDate ||
                !absenceForm.endDate
              }
            >
              {absenceLoading ? (
                <Loader2 className="h-4 w-4 animate-spin me-1" />
              ) : (
                <Check className="h-4 w-4 me-1" />
              )}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
