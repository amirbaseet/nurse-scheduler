import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";

const selfAssignSchema = z.object({
  gaps: z.array(
    z.object({
      clinicId: z.string().min(1),
      day: z.enum(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]),
      shiftStart: z.string().regex(/^\d{2}:\d{2}$/),
      shiftEnd: z.string().regex(/^\d{2}:\d{2}$/),
      hours: z.number().positive().max(24),
    }),
  ),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await authGuard("MANAGER");

    const body = await request.json();
    const { gaps } = selfAssignSchema.parse(body);

    // Verify schedule exists
    const schedule = await db.weeklySchedule.findUnique({
      where: { id: params.id },
    });

    if (!schedule) {
      return NextResponse.json({ error: "לו״ז לא נמצא" }, { status: 404 });
    }

    // Find manager's nurse profile
    const nurseProfile = await db.nurseProfile.findUnique({
      where: { userId: user.id },
    });

    if (!nurseProfile) {
      return NextResponse.json(
        { error: "פרופיל אחות לא נמצא" },
        { status: 404 },
      );
    }

    // Validate no duplicate days in the request
    const daySet = new Set<string>();
    for (const gap of gaps) {
      if (daySet.has(gap.day)) {
        return NextResponse.json(
          { error: `יום כפול בבקשה: ${gap.day}` },
          { status: 400 },
        );
      }
      daySet.add(gap.day);
    }

    // Validate total hours don't exceed contract
    const totalHours = gaps.reduce((sum, g) => sum + g.hours, 0);
    if (totalHours > nurseProfile.contractHours) {
      return NextResponse.json(
        {
          error: `סה״כ שעות (${totalHours}) חורג משעות החוזה (${nurseProfile.contractHours})`,
        },
        { status: 400 },
      );
    }

    // Replace all manager self-assignments in a transaction
    await db.$transaction([
      // Delete existing self-assignments
      db.scheduleAssignment.deleteMany({
        where: {
          scheduleId: params.id,
          nurseId: nurseProfile.id,
          isManagerSelf: true,
        },
      }),
      // Create new ones
      ...(gaps.length > 0
        ? [
            db.scheduleAssignment.createMany({
              data: gaps.map((gap) => ({
                scheduleId: params.id,
                nurseId: nurseProfile.id,
                day: gap.day,
                primaryClinicId: gap.clinicId,
                shiftStart: gap.shiftStart,
                shiftEnd: gap.shiftEnd,
                hours: gap.hours,
                isManagerSelf: true,
                isOff: false,
                isFixed: false,
              })),
            }),
          ]
        : []),
    ]);

    // Return updated manager assignments
    const assignments = await db.scheduleAssignment.findMany({
      where: {
        scheduleId: params.id,
        nurseId: nurseProfile.id,
      },
      include: {
        primaryClinic: true,
        secondaryClinic: true,
        nurse: { include: { user: true } },
      },
      orderBy: { day: "asc" },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    return handleApiError(error);
  }
}
