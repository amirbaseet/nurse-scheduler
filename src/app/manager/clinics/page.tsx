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

  return <ClinicsConfig clinics={clinics} />;
}
