"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/use-translation";

type Task = {
  id: string;
  title: string;
  description: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  isForAll: boolean;
  priority: "LOW" | "NORMAL" | "URGENT";
  status: "PENDING" | "COMPLETED";
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [isForAll, setIsForAll] = useState(false);
  const [priority, setPriority] = useState("NORMAL");
  const [dueDate, setDueDate] = useState("");

  const { t } = useTranslation();

  const PRIORITY_LABELS: Record<string, string> = {
    LOW: t("priority_low"),
    NORMAL: t("priority_normal"),
    URGENT: t("priority_urgent"),
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/nurses").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([t, n]) => {
        setTasks(t);
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
    setDescription("");
    setAssignedToId("");
    setIsForAll(false);
    setPriority("NORMAL");
    setDueDate("");
  };

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          assignedToId: isForAll ? undefined : assignedToId || undefined,
          isForAll,
          priority,
          dueDate: dueDate || undefined,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setTasks((prev) => [created, ...prev]);
        setShowCreate(false);
        resetForm();
      }
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setCreating(false);
    }
  }, [title, description, assignedToId, isForAll, priority, dueDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingTasks = tasks.filter((t) => t.status === "PENDING");
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("tasks")}</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 me-2" />
          {t("create_task")}
        </Button>
      </div>

      {/* Pending tasks */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("pending")} ({pendingTasks.length})
        </h2>
        {pendingTasks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t("no_tasks")}
            </CardContent>
          </Card>
        ) : (
          pendingTasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {task.isForAll ? (
                          <span>{t("for_all_nurses")}</span>
                        ) : task.assignedTo ? (
                          <span>{task.assignedTo.name}</span>
                        ) : null}
                        {task.dueDate && (
                          <span>
                            {t("due_date")}: {formatDateHe(task.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge className={PRIORITY_STYLES[task.priority]}>
                    {PRIORITY_LABELS[task.priority]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t("task_completed")} ({completedTasks.length})
          </h2>
          {completedTasks.map((task) => (
            <Card key={task.id} className="opacity-60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="line-through">{task.title}</span>
                  <span className="text-xs text-muted-foreground ms-auto">
                    {task.assignedTo?.name ?? t("all_label")}
                  </span>
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
            <DialogTitle>{t("create_task")}</DialogTitle>
            <DialogDescription>{t("create_task_desc")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>{t("task_title")}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("task_title_placeholder")}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>{t("task_description")}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("task_desc_placeholder")}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={isForAll} onCheckedChange={setIsForAll} />
              <Label>{t("for_all_nurses")}</Label>
            </div>

            {!isForAll && (
              <div className="grid gap-1.5">
                <Label>{t("assign_to")}</Label>
                <Select value={assignedToId} onValueChange={setAssignedToId}>
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
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("priority_label")}</Label>
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
                <Label>{t("due_date")}</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              disabled={creating}
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={creating || !title.trim()}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : (
                <Plus className="h-4 w-4 me-2" />
              )}
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
