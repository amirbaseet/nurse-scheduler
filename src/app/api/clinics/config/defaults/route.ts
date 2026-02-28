import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { updateClinicConfigSchema } from "@/lib/validations";

export async function PUT(request: Request) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const { configs } = updateClinicConfigSchema.parse(body);

    let count = 0;
    for (const config of configs) {
      await db.clinicDefaultConfig.upsert({
        where: {
          clinicId_day: {
            clinicId: config.clinicId,
            day: config.day,
          },
        },
        create: {
          clinicId: config.clinicId,
          day: config.day,
          shiftStart: config.shiftStart,
          shiftEnd: config.shiftEnd,
          nursesNeeded: config.nursesNeeded,
          isActive: config.isActive,
        },
        update: {
          shiftStart: config.shiftStart,
          shiftEnd: config.shiftEnd,
          nursesNeeded: config.nursesNeeded,
          isActive: config.isActive,
        },
      });
      count++;
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    return handleApiError(error);
  }
}
