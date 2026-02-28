import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { updateNurseSchema } from "@/lib/validations";
import { toJsonArray } from "@/lib/json-arrays";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const input = updateNurseSchema.parse(body);

    // Check nurse exists
    const existing = await db.nurseProfile.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "אחות לא נמצאה" },
        { status: 404 }
      );
    }

    const { recurringOffDays, ...rest } = input;

    const updated = await db.nurseProfile.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(recurringOffDays !== undefined && {
          recurringOffDays: toJsonArray(recurringOffDays),
        }),
      },
      include: { user: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
