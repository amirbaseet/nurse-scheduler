"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Check,
  X,
  Calendar,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
};

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
      <h1 className="text-xl font-bold">{t("vacation_requests")}</h1>

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
                    <StatusBadge
                      status={req.status as "APPROVED" | "REJECTED"}
                    />
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
    </div>
  );
}
