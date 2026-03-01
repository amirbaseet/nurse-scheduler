"use client";

import { useCallback, useEffect, useState } from "react";
import { NotificationBell } from "./notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";

type NotificationItem = {
  id: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};

export function ManagerTopBar({ userName }: { userName: string }) {
  const { t } = useTranslation();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then(
        (data: {
          notifications: {
            id: string;
            title: string;
            isRead: boolean;
            createdAt: string;
          }[];
        }) => {
          setNotifications(
            data.notifications.map((n) => ({
              id: n.id,
              message: n.title,
              createdAt: n.createdAt,
              isRead: n.isRead,
            })),
          );
        },
      )
      .catch(() => {});
  }, []);

  const handleMarkRead = useCallback((id: string) => {
    fetch(`/api/notifications/${id}/read`, { method: "PUT" }).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div />

      <div className="flex items-center gap-2">
        <NotificationBell
          notifications={notifications}
          onMarkRead={handleMarkRead}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {userName.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{userName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <form action="/api/auth/logout" method="POST">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  {t("logout")}
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
