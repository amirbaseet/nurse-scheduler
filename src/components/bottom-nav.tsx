"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  CalendarDays,
  Palmtree,
  Settings2,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/use-translation";

const NAV_ITEMS = [
  { href: "/nurse", icon: LayoutDashboard, labelKey: "dashboard" },
  { href: "/nurse/schedule", icon: CalendarDays, labelKey: "schedule" },
  { href: "/nurse/requests", icon: Palmtree, labelKey: "requests" },
  { href: "/nurse/preferences", icon: Settings2, labelKey: "preferences" },
  { href: "/nurse/tasks", icon: ClipboardList, labelKey: "tasks" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t bg-background safe-area-bottom">
      <div className="flex items-stretch justify-around">
        {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
          const isActive =
            href === "/nurse"
              ? pathname === "/nurse"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2",
                "min-h-[56px] text-xs transition-colors",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-[64px]">{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
