import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { NurseProfileForm } from "./_components/nurse-profile-form";
import type { SerializedNurse } from "@/types/nurse";

type Clinic = { id: string; name: string };

async function getNurse(id: string): Promise<{ nurse: SerializedNurse; allClinics: Clinic[] } | null> {
  const [nurse, clinics] = await Promise.all([
    db.nurseProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, nameAr: true, isActive: true } },
        blockedClinics: { include: { clinic: { select: { id: true, name: true } } } },
        fixedAssignments: { include: { clinic: { select: { id: true, name: true } } } },
      },
    }),
    db.clinic.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!nurse) return null;

  const serialized: SerializedNurse = {
    ...nurse,
    fixedAssignments: nurse.fixedAssignments.map((fa) => ({
      ...fa,
      weekStart: fa.weekStart.toISOString(),
    })),
  };

  return { nurse: serialized, allClinics: clinics };
}

export default async function NurseProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getNurse(params.id);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <NurseProfileForm nurse={data.nurse} allClinics={data.allClinics} />
    </div>
  );
}
