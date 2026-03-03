import { db } from "@/lib/db";
import { NursesTable } from "./_components/nurses-table";
import type { SerializedNurse } from "@/types/nurse";

async function getNurses(): Promise<SerializedNurse[]> {
  const nurses = await db.nurseProfile.findMany({
    where: { user: { role: "NURSE" } },
    include: {
      user: { select: { id: true, name: true, nameAr: true, isActive: true } },
      blockedClinics: {
        include: { clinic: { select: { id: true, name: true } } },
      },
      fixedAssignments: {
        include: { clinic: { select: { id: true, name: true } } },
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  return nurses.map((nurse) => ({
    ...nurse,
    fixedAssignments: nurse.fixedAssignments.map((fa) => ({
      ...fa,
      weekStart: fa.weekStart.toISOString(),
    })),
  }));
}

export default async function NursesPage() {
  const nurses = await getNurses();

  return <NursesTable nurses={nurses} />;
}
