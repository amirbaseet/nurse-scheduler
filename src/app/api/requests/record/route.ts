import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { recordAbsenceSchema } from "@/lib/validations";
import { parseWeekParam } from "@/lib/utils";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    const manager = await authGuard("MANAGER");

    const body = await request.json();
    const input = recordAbsenceSchema.parse(body);

    const startDate = parseWeekParam(input.startDate);
    const endDate = parseWeekParam(input.endDate);

    if (!startDate || !endDate) {
      return apiError(API_ERRORS.INVALID_DATE, 400);
    }

    if (endDate < startDate) {
      return apiError(API_ERRORS.END_DATE_AFTER_START, 400);
    }

    // Verify nurse exists and is active
    const nurse = await db.user.findFirst({
      where: { id: input.nurseId, role: "NURSE", isActive: true },
    });

    if (!nurse) {
      return apiError(API_ERRORS.NURSE_NOT_FOUND_OR_INACTIVE, 404);
    }

    // Create auto-approved absence record
    const now = new Date();
    const timeOffRequest = await db.timeOffRequest.create({
      data: {
        nurseId: input.nurseId,
        type: input.type,
        startDate,
        endDate,
        reason: input.reason,
        managerNote: input.managerNote,
        status: "APPROVED",
        createdById: manager.id,
        respondedAt: now,
      },
      include: { nurse: { select: { id: true, name: true } } },
    });

    // Notify the nurse
    await db.notification.create({
      data: {
        userId: input.nurseId,
        type: "absence_recorded",
        title: `נרשמה היעדרות: ${input.type}`,
        body: `${input.startDate} — ${input.endDate}`,
        link: "/nurse/requests",
      },
    });

    return NextResponse.json(timeOffRequest, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
