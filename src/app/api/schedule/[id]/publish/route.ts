import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await authGuard("MANAGER");

    const schedule = await db.weeklySchedule.findUnique({
      where: { id: params.id },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: "לו״ז לא נמצא" },
        { status: 404 }
      );
    }

    await db.weeklySchedule.update({
      where: { id: params.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    // Notify all active nurses
    const nurses = await db.user.findMany({
      where: { role: "NURSE", isActive: true },
    });

    await db.notification.createMany({
      data: nurses.map((nurse) => ({
        userId: nurse.id,
        type: "schedule_published",
        title: "הלו״ז השבועי פורסם",
        link: "/nurse/schedule",
      })),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
