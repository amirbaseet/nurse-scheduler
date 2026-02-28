"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Calendar, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { useTranslation } from "@/i18n/use-translation";

type TimeOffRequest = {
  id: string;
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

const REQUEST_TYPES = ["VACATION", "SICK", "PERSONAL", "OFF_DAY"] as const;
const TYPE_TRANSLATION_KEYS: Record<string, string> = {
  VACATION: "type_vacation",
  SICK: "type_sick",
  PERSONAL: "type_personal",
  OFF_DAY: "type_off_day",
};

function formatDateHe(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function NurseRequestsPage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Form state
  const [formType, setFormType] = useState<string>("VACATION");
  const [startDate, setStartDate] = useState(getTomorrow());
  const [endDate, setEndDate] = useState(getTomorrow());
  const [reason, setReason] = useState("");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/requests/my");
      if (res.ok) {
        setRequests(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Auto-set endDate = startDate for OFF_DAY
  useEffect(() => {
    if (formType === "OFF_DAY") {
      setEndDate(startDate);
    }
  }, [formType, startDate]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSuccessMsg("");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          startDate,
          endDate,
          reason: reason || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setRequests((prev) => [created, ...prev]);
        setShowForm(false);
        setFormType("VACATION");
        setStartDate(getTomorrow());
        setEndDate(getTomorrow());
        setReason("");
        setSuccessMsg(t("request_sent"));
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error("Failed to submit request:", err);
    } finally {
      setSubmitting(false);
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
        <h1 className="text-lg font-bold">{t("requests")}</h1>
        <Button
          size="sm"
          variant={showForm ? "outline" : "default"}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? (
            <>
              <X className="h-4 w-4 me-1" />
              {t("cancel")}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 me-1" />
              {t("new_request")}
            </>
          )}
        </Button>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}

      {/* New request form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Type select */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                {t("select_type")}
              </label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
              >
                {REQUEST_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_ICONS[type]} {t(TYPE_TRANSLATION_KEYS[type])}
                  </option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t("start_date")}
                </label>
                <Input
                  type="date"
                  min={getTomorrow()}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t("end_date")}
                </label>
                <Input
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={formType === "OFF_DAY"}
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                {t("reason")}
              </label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none"
                placeholder={`${t("reason")} (${t("notes")})`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin me-1" />
              ) : null}
              {t("submit")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Request list */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("no_requests")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <Card key={req.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{TYPE_ICONS[req.type]}</span>
                    <span className="font-medium">
                      {t(TYPE_TRANSLATION_KEYS[req.type])}
                    </span>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatDateHe(req.startDate)} — {formatDateHe(req.endDate)}
                  </span>
                </div>

                {req.reason && (
                  <p className="text-sm text-muted-foreground">
                    {t("reason")}: {req.reason}
                  </p>
                )}

                {req.managerNote && (
                  <p className="text-sm mt-1">
                    <span className="font-medium">{t("manager_note")}:</span>{" "}
                    {req.managerNote}
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  {formatDateHe(req.requestedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
