import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { createAnnouncementSchema } from "@/lib/validations";
import { toJsonArray } from "@/lib/json-arrays";

export async function GET() {
  try {
    const user = await authGuard();

    const announcements = await db.announcement.findMany({
      where: {
        AND: [
          {
            OR: [
              { targetAll: true },
              { targetNurseIds: { contains: user.id } },
            ],
          },
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        ],
      },
      include: {
        author: true,
        reads: { where: { userId: user.id } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Add computed isRead field
    const withReadStatus = announcements.map(({ reads, ...rest }) => ({
      ...rest,
      isRead: reads.length > 0,
    }));

    return NextResponse.json(withReadStatus);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authGuard("MANAGER");

    const body = await request.json();
    const input = createAnnouncementSchema.parse(body);

    const announcement = await db.announcement.create({
      data: {
        authorId: user.id,
        title: input.title,
        body: input.body,
        priority: input.priority,
        targetAll: input.targetAll,
        targetNurseIds: input.targetNurseIds
          ? toJsonArray(input.targetNurseIds)
          : "[]",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    // Notify targets
    const targets = input.targetAll
      ? await db.user.findMany({
          where: { role: "NURSE", isActive: true },
        })
      : input.targetNurseIds
        ? await db.user.findMany({
            where: { id: { in: input.targetNurseIds } },
          })
        : [];

    if (targets.length > 0) {
      const prefix = input.priority === "URGENT" ? "🔴 " : "";
      await db.notification.createMany({
        data: targets.map((nurse) => ({
          userId: nurse.id,
          type: "new_announcement",
          title: `${prefix}${input.title}`,
          link: "/nurse/announcements",
        })),
      });
    }

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
