import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authGuard, handleApiError } from "@/lib/permissions";
import { createClinicSchema } from "@/lib/validations";

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

export async function POST(req: NextRequest) {
  try {
    await authGuard("MANAGER");

    const body = await req.json();
    const data = createClinicSchema.parse(body);

    // Check code uniqueness
    const existing = await db.clinic.findFirst({
      where: { code: data.code },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Clinic code already exists" },
        { status: 409 },
      );
    }

    const clinic = await db.clinic.create({
      data: {
        name: data.name,
        nameAr: data.nameAr,
        code: data.code,
        genderPref: data.genderPref ?? "ANY",
        canBeSecondary: data.canBeSecondary ?? false,
        secondaryHours: data.secondaryHours,
        secondaryNursesNeeded: data.secondaryNursesNeeded ?? 0,
      },
      include: { defaultConfigs: true },
    });

    return NextResponse.json(clinic, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
