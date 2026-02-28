import { db } from "@/lib/db";
import { getWeekStart, formatDate } from "@/lib/utils";
import { DashboardClient } from "./_components/dashboard-client";

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

  const coveragePercent =
    totalClinicSlots > 0
      ? Math.round((clinicsCovered / totalClinicSlots) * 100)
      : 0;

  return {
    pendingRequests,
    totalNurses,
    preferencesCount,
    scheduleStatus: currentSchedule?.status ?? null,
    qualityScore: currentSchedule?.qualityScore ?? null,
    coveragePercent,
    weekLabel: formatDate(weekStart),
  };
}

export default async function ManagerDashboard() {
  const data = await getDashboardData();
  return <DashboardClient data={data} />;
}
