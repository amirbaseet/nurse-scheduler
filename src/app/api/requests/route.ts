import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { createRequestSchema } from "@/lib/validations";
import { parseWeekParam } from "@/lib/utils";
import { apiError, API_ERRORS } from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    const user = await authGuard("NURSE");

    const body = await request.json();
    const input = createRequestSchema.parse(body);

    const startDate = parseWeekParam(input.startDate);
    const endDate = parseWeekParam(input.endDate);

    if (!startDate || !endDate) {
      return apiError(API_ERRORS.INVALID_DATE, 400);
    }

    // startDate must be in the future
    if (startDate <= new Date()) {
      return apiError(API_ERRORS.START_DATE_MUST_BE_FUTURE, 400);
    }

    // endDate >= startDate
    if (endDate < startDate) {
      return apiError(API_ERRORS.END_DATE_AFTER_START, 400);
    }

    // OFF_DAY: startDate must equal endDate
    if (input.type === "OFF_DAY" && startDate.getTime() !== endDate.getTime()) {
      return apiError(API_ERRORS.OFF_DAY_SINGLE_DAY_ONLY, 400);
    }

    // No duplicate pending request for same dates
    const duplicate = await db.timeOffRequest.findFirst({
      where: {
        nurseId: user.id,
        status: "PENDING",
        startDate,
        endDate,
      },
    });

    if (duplicate) {
      return apiError(API_ERRORS.DUPLICATE_PENDING_REQUEST, 409);
    }

    const timeOffRequest = await db.timeOffRequest.create({
      data: {
        nurseId: user.id,
        type: input.type,
        startDate,
        endDate,
        reason: input.reason,
      },
    });

    // Notify manager
    const manager = await db.user.findFirst({
      where: { role: "MANAGER" },
    });

    if (manager) {
      await db.notification.create({
        data: {
          userId: manager.id,
          type: "new_request",
          title: `${user.name} — בקשת ${input.type}`,
          link: "/manager/requests",
        },
      });
    }

    return NextResponse.json(timeOffRequest, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
