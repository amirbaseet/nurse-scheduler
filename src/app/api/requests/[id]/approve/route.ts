import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { respondRequestSchema } from "@/lib/validations";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await authGuard("MANAGER");

    const body = await request.json().catch(() => ({}));
    const input = respondRequestSchema.parse(body);

    const existing = await db.timeOffRequest.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "בקשה לא נמצאה" },
        { status: 404 }
      );
    }

    const updated = await db.timeOffRequest.update({
      where: { id: params.id },
      data: {
        status: "APPROVED",
        managerNote: input.managerNote,
        respondedAt: new Date(),
      },
    });

    await db.notification.create({
      data: {
        userId: existing.nurseId,
        type: "request_approved",
        title: "הבקשה שלך אושרה",
        link: "/nurse/requests",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
