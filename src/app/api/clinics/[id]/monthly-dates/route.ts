import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { upsertMonthlyDatesSchema } from "@/lib/validations";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await authGuard("MANAGER");

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // "2026-03"

    const clinic = await db.clinic.findUnique({ where: { id: params.id } });
    if (!clinic) {
      return apiError(API_ERRORS.CLINIC_NOT_FOUND, 404);
    }

    const where: Record<string, unknown> = { clinicId: params.id };

    if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      const [year, mon] = month.split("-").map(Number);
      const start = new Date(Date.UTC(year, mon - 1, 1));
      const end = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));
      where.date = { gte: start, lte: end };
    }

    const dates = await db.clinicMonthlyDate.findMany({
      where,
      orderBy: { date: "asc" },
    });

    return NextResponse.json(dates);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const { dates, deleteIds } = upsertMonthlyDatesSchema.parse(body);

    const clinic = await db.clinic.findUnique({ where: { id: params.id } });
    if (!clinic) {
      return apiError(API_ERRORS.CLINIC_NOT_FOUND, 404);
    }

    // Atomic transaction: upsert all dates + delete removed ones
    await db.$transaction(async (tx) => {
      for (const d of dates) {
        const dateObj = new Date(d.date + "T00:00:00.000Z");
        await tx.clinicMonthlyDate.upsert({
          where: {
            clinicId_date: {
              clinicId: params.id,
              date: dateObj,
            },
          },
          update: {
            shiftStart: d.shiftStart,
            shiftEnd: d.shiftEnd,
            nursesNeeded: d.nursesNeeded,
            isActive: d.isActive,
          },
          create: {
            clinicId: params.id,
            date: dateObj,
            shiftStart: d.shiftStart,
            shiftEnd: d.shiftEnd,
            nursesNeeded: d.nursesNeeded,
            isActive: d.isActive,
          },
        });
      }

      if (deleteIds && deleteIds.length > 0) {
        await tx.clinicMonthlyDate.deleteMany({
          where: {
            id: { in: deleteIds },
            clinicId: params.id,
          },
        });
      }
    });

    return NextResponse.json({ success: true, count: dates.length });
  } catch (error) {
    return handleApiError(error);
  }
}
