import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { updateBlockedClinicsSchema } from "@/lib/validations";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const { clinicIds } = updateBlockedClinicsSchema.parse(body);

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

    // Replace all blocked clinics in a transaction
    await db.$transaction([
      db.nurseBlockedClinic.deleteMany({ where: { nurseId: params.id } }),
      db.nurseBlockedClinic.createMany({
        data: clinicIds.map((clinicId) => ({
          nurseId: params.id,
          clinicId,
        })),
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
