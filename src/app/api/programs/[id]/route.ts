import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { updateProgramSchema } from "@/lib/validations";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await authGuard("MANAGER");

    const body = await request.json();
    const input = updateProgramSchema.parse(body);

    const existing = await db.patientProgram.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "תכנית לא נמצאה" },
        { status: 404 }
      );
    }

    const updated = await db.patientProgram.update({
      where: { id: params.id },
      data: input,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
