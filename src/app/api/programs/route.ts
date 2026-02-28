import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function GET() {
  try {
    await authGuard("MANAGER");

    const programs = await db.patientProgram.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json(programs);
  } catch (error) {
    return handleApiError(error);
  }
}
