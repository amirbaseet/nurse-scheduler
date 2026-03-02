import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function GET() {
  try {
    await authGuard("MANAGER");

    const requests = await db.timeOffRequest.findMany({
      where: { status: { not: "PENDING" } },
      include: { nurse: { select: { id: true, name: true } } },
      orderBy: { respondedAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    return handleApiError(error);
  }
}
