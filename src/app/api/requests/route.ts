import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { createRequestSchema } from "@/lib/validations";
import { parseWeekParam } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const user = await authGuard("NURSE");

    const body = await request.json();
    const input = createRequestSchema.parse(body);

    const startDate = parseWeekParam(input.startDate);
    const endDate = parseWeekParam(input.endDate);

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "תאריך לא תקין" },
        { status: 400 }
      );
    }

    // startDate must be in the future
    if (startDate <= new Date()) {
      return NextResponse.json(
        { error: "תאריך התחלה חייב להיות בעתיד" },
        { status: 400 }
      );
    }

    // endDate >= startDate
    if (endDate < startDate) {
      return NextResponse.json(
        { error: "תאריך סיום חייב להיות אחרי תאריך התחלה" },
        { status: 400 }
      );
    }

    // OFF_DAY: startDate must equal endDate
    if (input.type === "OFF_DAY" && startDate.getTime() !== endDate.getTime()) {
      return NextResponse.json(
        { error: "יום חופש חייב להיות ליום אחד בלבד" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "כבר קיימת בקשה ממתינה לתאריכים אלה" },
        { status: 409 }
      );
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
