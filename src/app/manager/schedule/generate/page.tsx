"use client";

import { useTranslation } from "@/i18n/use-translation";
import { GenerateWizard } from "./_components/generate-wizard";

export default function GenerateSchedulePage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("generate_schedule")}</h1>
      <GenerateWizard />
    </div>
  );
}
