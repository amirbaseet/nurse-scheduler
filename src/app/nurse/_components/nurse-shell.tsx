"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BottomNav } from "@/components/bottom-nav";
import { useTranslation } from "@/i18n/use-translation";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NurseShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const { t, locale, setLocale } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { notifications: [], unreadCount: 0 }))
      .then((data: { notifications: Notification[]; unreadCount: number }) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  }, []);

  const handleMarkRead = useCallback((id: string) => {
    fetch(`/api/notifications/${id}/read`, { method: "PUT" }).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{t("app_name")}</span>
          <button
            onClick={() => setLocale(locale === "he" ? "ar" : "he")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {locale === "he" ? "AR" : "HE"}
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -start-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {notifications.length === 0 ? (
              <DropdownMenuItem disabled>
                {t("notifications")} — {t("no_tasks")}
              </DropdownMenuItem>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={n.isRead ? "opacity-60" : "font-medium"}
                >
                  <span className="truncate">{n.title}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Main content — padded for bottom nav */}
      <main className="flex-1 overflow-y-auto px-4 pb-20 pt-4">{children}</main>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  );
}
