import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function GET() {
  try {
    const user = await authGuard();

    const requests = await db.timeOffRequest.findMany({
      where: { nurseId: user.id },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    return handleApiError(error);
  }
}
