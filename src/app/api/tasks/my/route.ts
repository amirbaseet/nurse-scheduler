import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function GET() {
  try {
    const user = await authGuard();

    const tasks = await db.task.findMany({
      where: {
        OR: [
          { assignedToId: user.id },
          { isForAll: true },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    return handleApiError(error);
  }
}
