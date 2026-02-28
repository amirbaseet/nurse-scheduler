"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Megaphone, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n/use-translation";

type Announcement = {
  id: string;
  authorId: string;
  author: { id: string; name: string };
  title: string;
  body: string;
  priority: "LOW" | "NORMAL" | "URGENT";
  targetAll: boolean;
  targetNurseIds: string;
  expiresAt: string | null;
  createdAt: string;
  isRead: boolean;
};

type NurseOption = { id: string; name: string };

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  NORMAL: "bg-blue-100 text-blue-700",
  URGENT: "bg-red-100 text-red-700",
};

function formatDateHe(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [targetAll, setTargetAll] = useState(true);
  const [targetNurseIds, setTargetNurseIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");

  const { t } = useTranslation();

  const PRIORITY_LABELS: Record<string, string> = {
    LOW: t("priority_low"),
    NORMAL: t("priority_normal"),
    URGENT: t("priority_urgent"),
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/announcements").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/nurses").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([a, n]) => {
        setAnnouncements(a);
        setNurses(
          n.map((nurse: { user: { id: string; name: string } }) => ({
            id: nurse.user.id,
            name: nurse.user.name,
          })),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setTitle("");
    setBody("");
    setPriority("NORMAL");
    setTargetAll(true);
    setTargetNurseIds([]);
    setExpiresAt("");
  };

  const handleCreate = useCallback(async () => {
    if (!title.trim() || !body.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          priority,
          targetAll,
          targetNurseIds: targetAll ? undefined : targetNurseIds,
          expiresAt: expiresAt || undefined,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setAnnouncements((prev) => [
          {
            ...created,
            author: { id: created.authorId, name: "את" },
            isRead: true,
          },
          ...prev,
        ]);
        setShowCreate(false);
        resetForm();
      }
    } catch (err) {
      console.error("Failed to create announcement:", err);
    } finally {
      setCreating(false);
    }
  }, [title, body, priority, targetAll, targetNurseIds, expiresAt]);

  const toggleNurseTarget = (nurseId: string) => {
    setTargetNurseIds((prev) =>
      prev.includes(nurseId)
        ? prev.filter((id) => id !== nurseId)
        : [...prev, nurseId],
    );
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
        <h1 className="text-xl font-bold">{t("announcements")}</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 me-2" />
          {t("create_announcement")}
        </Button>
      </div>

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("no_announcements")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Card key={ann.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Megaphone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">{ann.title}</div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {ann.body}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{formatDateHe(ann.createdAt)}</span>
                        <span>•</span>
                        <span>
                          {ann.targetAll
                            ? t("target_all")
                            : t("target_specific")}
                        </span>
                        {ann.expiresAt && (
                          <>
                            <span>•</span>
                            <span>
                              {t("expires_at")}: {formatDateHe(ann.expiresAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={PRIORITY_STYLES[ann.priority]}>
                      {PRIORITY_LABELS[ann.priority]}
                    </Badge>
                    {ann.isRead ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setShowCreate(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("create_announcement")}</DialogTitle>
            <DialogDescription>שלח הודעה לאחיות</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>{t("announcement_title")}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("announcement_title_placeholder")}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>{t("announcement_body")}</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("announcement_body_placeholder")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>עדיפות</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">{t("priority_low")}</SelectItem>
                    <SelectItem value="NORMAL">
                      {t("priority_normal")}
                    </SelectItem>
                    <SelectItem value="URGENT">
                      {t("priority_urgent")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("expires_at")}</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={targetAll} onCheckedChange={setTargetAll} />
              <Label>{t("target_all")}</Label>
            </div>

            {!targetAll && (
              <div className="grid gap-1.5">
                <Label>{t("target_specific")}</Label>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                  {nurses.map((n) => (
                    <label
                      key={n.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={targetNurseIds.includes(n.id)}
                        onCheckedChange={() => toggleNurseTarget(n.id)}
                      />
                      <span className="text-sm">{n.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              disabled={creating}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !title.trim() || !body.trim()}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : (
                <Plus className="h-4 w-4 me-2" />
              )}
              יצירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
