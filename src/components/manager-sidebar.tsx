"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Zap,
  UserCheck,
  Users,
  Building2,
  ClipboardList,
  FileText,
  Settings,
  CheckSquare,
  Megaphone,
  UserCog,
  LogOut,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/use-translation";

const navItems = [
  { href: "/manager", icon: LayoutDashboard, labelKey: "dashboard" },
  { href: "/manager/schedule", icon: Calendar, labelKey: "schedule" },
  { href: "/manager/schedule/generate", icon: Zap, labelKey: "generate" },
  { href: "/manager/schedule/self-assign", icon: UserCheck, labelKey: "self_assign" },
  { href: "/manager/nurses", icon: Users, labelKey: "nurses" },
  { href: "/manager/clinics", icon: Building2, labelKey: "clinics" },
  { href: "/manager/programs", icon: ClipboardList, labelKey: "programs" },
  { href: "/manager/requests", icon: FileText, labelKey: "requests" },
  { href: "/manager/preferences", icon: Settings, labelKey: "preferences" },
  { href: "/manager/tasks", icon: CheckSquare, labelKey: "tasks" },
  { href: "/manager/announcements", icon: Megaphone, labelKey: "announcements" },
  { href: "/manager/users", icon: UserCog, labelKey: "users" },
];

export function ManagerSidebar() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useTranslation();

  return (
    <aside className="flex h-screen w-60 flex-col border-e bg-card">
      <div className="flex h-14 items-center justify-center border-b px-4">
        <span className="text-lg font-bold text-primary">NurseScheduler Pro</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/manager"
              ? pathname === "/manager"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="p-2 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => setLocale(locale === "he" ? "ar" : "he")}
        >
          <Languages className="h-4 w-4" />
          {locale === "he" ? "العربية" : "עברית"}
        </Button>

        <form action="/api/auth/logout" method="POST">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
            {t("logout")}
          </Button>
        </form>
      </div>
    </aside>
  );
}
