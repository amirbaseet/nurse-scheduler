import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function GET() {
  try {
    await authGuard("MANAGER");

    const nurses = await db.nurseProfile.findMany({
      where: { user: { isActive: true } },
      include: {
        user: true,
        blockedClinics: { include: { clinic: true } },
        fixedAssignments: { include: { clinic: true } },
      },
    });

    return NextResponse.json(nurses);
  } catch (error) {
    return handleApiError(error);
  }
}
