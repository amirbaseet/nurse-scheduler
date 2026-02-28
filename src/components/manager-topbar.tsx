"use client";

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

export function ManagerTopBar({ userName }: { userName: string }) {
  const { t } = useTranslation();

  const notifications: {
    id: string;
    message: string;
    createdAt: string;
    isRead: boolean;
  }[] = [];

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div />

      <div className="flex items-center gap-2">
        <NotificationBell
          notifications={notifications}
          onMarkRead={() => {}}
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
