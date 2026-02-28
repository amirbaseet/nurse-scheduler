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
import { db } from "@/lib/db";
import { getWeekStart, formatDate } from "@/lib/utils";

async function getDashboardData() {
  const weekStart = getWeekStart();

  const [
    pendingRequests,
    totalNurses,
    preferencesCount,
    currentSchedule,
  ] = await Promise.all([
    db.timeOffRequest.count({
      where: { status: "PENDING" },
    }),
    db.nurseProfile.count({
      where: { user: { isActive: true, role: "NURSE" } },
    }),
    db.weeklyPreference.count({
      where: { weekStart },
    }),
    db.weeklySchedule.findFirst({
      where: { weekStart },
      select: { id: true, status: true, qualityScore: true },
    }),
  ]);

  let clinicsCovered = 0;
  let totalClinicSlots = 0;

  if (currentSchedule) {
    const [assignments, clinicConfigs] = await Promise.all([
      db.scheduleAssignment.count({
        where: {
          scheduleId: currentSchedule.id,
          primaryClinicId: { not: null },
        },
      }),
      db.clinicDefaultConfig.count({
        where: { isActive: true },
      }),
    ]);
    clinicsCovered = assignments;
    totalClinicSlots = clinicConfigs;
  }

  return {
    pendingRequests,
    totalNurses,
    preferencesCount,
    scheduleStatus: currentSchedule?.status ?? null,
    qualityScore: currentSchedule?.qualityScore ?? null,
    clinicsCovered,
    totalClinicSlots,
    weekLabel: formatDate(weekStart),
  };
}

export default async function ManagerDashboard() {
  const data = await getDashboardData();

  const coveragePercent =
    data.totalClinicSlots > 0
      ? Math.round((data.clinicsCovered / data.totalClinicSlots) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">לוח ראשי</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              פעולות ממתינות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>{data.pendingRequests} בקשות חופשה</span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/manager/requests">סקירה</Link>
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span>
                {data.preferencesCount}/{data.totalNurses} העדפות הוגשו
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/manager/preferences">צפייה</Link>
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span>
                {data.scheduleStatus
                  ? `שבוע ${data.weekLabel}: ${data.scheduleStatus}`
                  : `שבוע ${data.weekLabel} טרם נוצר`}
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/manager/schedule/generate">יצירה</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* This Week Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              השבוע
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <StatItem
                icon={<Users className="h-4 w-4" />}
                label="אחיות פעילות"
                value={`${data.totalNurses}`}
              />
              <StatItem
                icon={<Building2 className="h-4 w-4" />}
                label="כיסוי מרפאות"
                value={data.scheduleStatus ? `${coveragePercent}%` : "—"}
              />
              <StatItem
                icon={<TrendingUp className="h-4 w-4" />}
                label="ציון איכות"
                value={
                  data.qualityScore !== null
                    ? `${data.qualityScore}/100`
                    : "—"
                }
              />
              <StatItem
                icon={<AlertCircle className="h-4 w-4" />}
                label="בקשות ממתינות"
                value={`${data.pendingRequests}`}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
