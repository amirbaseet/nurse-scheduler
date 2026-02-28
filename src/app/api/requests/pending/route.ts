import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function GET() {
  try {
    await authGuard("MANAGER");

    const requests = await db.timeOffRequest.findMany({
      where: { status: "PENDING" },
      include: { nurse: true },
      orderBy: { requestedAt: "asc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    return handleApiError(error);
  }
}
