import { db } from "@/lib/db";
import { ClinicsConfig } from "./_components/clinics-config";
import type { ClinicWithDefaults } from "@/types/clinic";

async function getClinics(): Promise<ClinicWithDefaults[]> {
  return db.clinic.findMany({
    include: { defaultConfigs: true },
    orderBy: { name: "asc" },
  });
}

export default async function ClinicsPage() {
  const clinics = await getClinics();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">מרפאות</h1>
      <ClinicsConfig clinics={clinics} />
    </div>
  );
}
