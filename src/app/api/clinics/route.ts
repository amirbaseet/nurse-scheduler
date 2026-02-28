import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function GET() {
  try {
    await authGuard("MANAGER");

    const clinics = await db.clinic.findMany({
      include: { defaultConfigs: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(clinics);
  } catch (error) {
    return handleApiError(error);
  }
}
