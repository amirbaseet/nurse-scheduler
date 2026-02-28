import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { submitPreferenceSchema } from "@/lib/validations";
import { parseWeekParam } from "@/lib/utils";
import { toJsonArray } from "@/lib/json-arrays";

export async function POST(request: Request) {
  try {
    const user = await authGuard("NURSE");

    const body = await request.json();
    const input = submitPreferenceSchema.parse(body);

    const weekStart = parseWeekParam(input.weekStart);

    if (!weekStart) {
      return NextResponse.json(
        { error: "תאריך לא תקין" },
        { status: 400 }
      );
    }

    const preferredDaysOff = input.preferredDaysOff
      ? toJsonArray(input.preferredDaysOff)
      : "[]";

    const preference = await db.weeklyPreference.upsert({
      where: {
        nurseId_weekStart: {
          nurseId: user.id,
          weekStart,
        },
      },
      create: {
        nurseId: user.id,
        weekStart,
        shiftPreference: input.shiftPreference,
        preferredDaysOff,
        notes: input.notes,
        submittedAt: new Date(),
      },
      update: {
        shiftPreference: input.shiftPreference,
        preferredDaysOff,
        notes: input.notes,
        submittedAt: new Date(),
      },
    });

    // Debounced notification: only at thresholds (5, 10, total)
    const count = await db.weeklyPreference.count({ where: { weekStart } });
    const total = await db.user.count({
      where: { role: "NURSE", isActive: true },
    });

    if (count === 5 || count === 10 || count === total) {
      const manager = await db.user.findFirst({
        where: { role: "MANAGER" },
      });

      if (manager) {
        await db.notification.create({
          data: {
            userId: manager.id,
            type: "preference_submitted",
            title: `${count}/${total} העדפות הוגשו`,
          },
        });
      }
    }

    return NextResponse.json(preference);
  } catch (error) {
    return handleApiError(error);
  }
}
