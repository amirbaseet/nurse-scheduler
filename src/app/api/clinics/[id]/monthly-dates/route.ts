import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { upsertMonthlyDatesSchema } from "@/lib/validations";

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
      return NextResponse.json({ error: "מרפאה לא נמצאה" }, { status: 404 });
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
      return NextResponse.json({ error: "מרפאה לא נמצאה" }, { status: 404 });
    }

    // Build all operations for a single atomic transaction
    const operations = dates.map((d) => {
      const dateObj = new Date(d.date + "T00:00:00.000Z");
      return db.clinicMonthlyDate.upsert({
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
    });

    // Delete removed dates in same transaction
    if (deleteIds && deleteIds.length > 0) {
      operations.push(
        db.clinicMonthlyDate.deleteMany({
          where: {
            id: { in: deleteIds },
            clinicId: params.id, // ensure ownership
          },
        }) as never, // type coercion for mixed transaction array
      );
    }

    await db.$transaction(operations);

    return NextResponse.json({ success: true, count: dates.length });
  } catch (error) {
    return handleApiError(error);
  }
}
