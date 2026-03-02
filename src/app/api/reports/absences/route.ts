import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

function getMonthBounds(monthStr: string) {
  const match = monthStr.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-indexed
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function daysBetweenClipped(
  absStart: Date,
  absEnd: Date,
  monthStart: Date,
  monthEnd: Date,
): number {
  const clippedStart = absStart < monthStart ? monthStart : absStart;
  const clippedEnd = absEnd > monthEnd ? monthEnd : absEnd;
  if (clippedEnd < clippedStart) return 0;
  return (
    Math.round(
      (clippedEnd.getTime() - clippedStart.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1
  );
}

export async function GET(request: NextRequest) {
  try {
    await authGuard("MANAGER");

    const monthParam = request.nextUrl.searchParams.get("month");
    if (!monthParam) {
      return NextResponse.json(
        { error: "חסר פרמטר month (YYYY-MM)" },
        { status: 400 },
      );
    }

    const bounds = getMonthBounds(monthParam);
    if (!bounds) {
      return NextResponse.json(
        { error: "פורמט month לא תקין (YYYY-MM)" },
        { status: 400 },
      );
    }

    const { start: monthStart, end: monthEnd } = bounds;

    // Fetch all approved time-off requests overlapping the month
    const requests = await db.timeOffRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      include: {
        nurse: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { startDate: "asc" },
    });

    // Fetch all active nurses for a complete list
    const nurses = await db.user.findMany({
      where: { role: "NURSE", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    // Build per-nurse report
    const report = nurses.map((nurse) => {
      const nurseRequests = requests.filter((r) => r.nurseId === nurse.id);

      const byType: Record<string, number> = {
        VACATION: 0,
        SICK: 0,
        PERSONAL: 0,
        OFF_DAY: 0,
      };

      let totalDays = 0;
      const absences = nurseRequests.map((r) => {
        const days = daysBetweenClipped(
          r.startDate,
          r.endDate,
          monthStart,
          monthEnd,
        );
        totalDays += days;
        byType[r.type] = (byType[r.type] ?? 0) + days;

        return {
          id: r.id,
          type: r.type,
          startDate: r.startDate.toISOString(),
          endDate: r.endDate.toISOString(),
          days,
          reason: r.reason,
          recordedByManager: r.createdById !== null,
        };
      });

      return {
        nurseId: nurse.id,
        nurseName: nurse.name,
        totalDays,
        byType,
        absences,
      };
    });

    return NextResponse.json({
      month: monthParam,
      report,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
