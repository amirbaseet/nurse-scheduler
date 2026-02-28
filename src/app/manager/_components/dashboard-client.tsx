"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Users,
  Building2,
  TrendingUp,
} from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";

type DashboardData = {
  pendingRequests: number;
  totalNurses: number;
  preferencesCount: number;
  scheduleStatus: string | null;
  qualityScore: number | null;
  coveragePercent: number;
  weekLabel: string;
};

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("dashboard")}</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              {t("pending_actions")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>{data.pendingRequests} {t("vacation_requests")}</span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/manager/requests">{t("review_action")}</Link>
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span>
                {data.preferencesCount}/{data.totalNurses} {t("preferences_submitted_count")}
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/manager/preferences">{t("view_action")}</Link>
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span>
                {data.scheduleStatus
                  ? `${t("week_status")} ${data.weekLabel}: ${data.scheduleStatus}`
                  : `${t("week_status")} ${data.weekLabel} ${t("week_not_created")}`}
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/manager/schedule/generate">{t("create_action")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* This Week Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t("this_week")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <StatItem
                icon={<Users className="h-4 w-4" />}
                label={t("active_nurses")}
                value={`${data.totalNurses}`}
              />
              <StatItem
                icon={<Building2 className="h-4 w-4" />}
                label={t("clinic_coverage")}
                value={data.scheduleStatus ? `${data.coveragePercent}%` : "—"}
              />
              <StatItem
                icon={<TrendingUp className="h-4 w-4" />}
                label={t("quality_score_label")}
                value={
                  data.qualityScore !== null
                    ? `${data.qualityScore}/100`
                    : "—"
                }
              />
              <StatItem
                icon={<AlertCircle className="h-4 w-4" />}
                label={t("pending_requests")}
                value={`${data.pendingRequests}`}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
