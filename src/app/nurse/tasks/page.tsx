"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, CheckCircle2, Clock, CircleDot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  description: string | null;
  isForAll: boolean;
  priority: "LOW" | "NORMAL" | "URGENT";
  status: "PENDING" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  NORMAL: "bg-blue-100 text-blue-700",
  URGENT: "bg-red-100 text-red-700",
};

function formatDateHe(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function NurseTasksPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    fetch("/api/tasks/my")
      .then((r) => (r.ok ? r.json() : []))
      .then(setTasks)
      .finally(() => setLoading(false));
  }, []);

  const handleComplete = useCallback(async (taskId: string) => {
    setCompleting(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/done`, {
        method: "PUT",
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status: "DONE" as const,
                  completedAt: new Date().toISOString(),
                }
              : task,
          ),
        );
      }
    } catch (err) {
      console.error("Failed to complete task:", err);
    } finally {
      setCompleting(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pending = tasks.filter((t) => t.status === "PENDING");
  const completed = tasks.filter((t) => t.status === "DONE");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">{t("tasks")}</h1>

      {/* Pending tasks */}
      {pending.length === 0 && completed.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("no_tasks")}
          </CardContent>
        </Card>
      ) : (
        <>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_tasks")}</p>
          ) : (
            <div className="space-y-3">
              {pending.map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Clock className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium">{task.title}</div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              className={cn(
                                "text-xs",
                                PRIORITY_STYLES[task.priority],
                              )}
                            >
                              {t(`priority_${task.priority.toLowerCase()}`)}
                            </Badge>
                            {task.dueDate && (
                              <span className="text-xs text-muted-foreground">
                                {t("due_date")}: {formatDateHe(task.dueDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-green-600 border-green-200 hover:bg-green-50"
                        disabled={completing === task.id}
                        onClick={() => handleComplete(task.id)}
                      >
                        {completing === task.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 me-1" />
                            {t("mark_done")}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Completed tasks (collapsible) */}
          {completed.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <CircleDot className="h-3.5 w-3.5" />
                {t("task_completed")} ({completed.length})
              </button>

              {showCompleted && (
                <div className="mt-2 space-y-2">
                  {completed.map((task) => (
                    <Card key={task.id} className="opacity-60">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          <span className="text-sm line-through">
                            {task.title}
                          </span>
                          {task.completedAt && (
                            <span className="text-xs text-muted-foreground ms-auto">
                              {formatDateHe(task.completedAt)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
