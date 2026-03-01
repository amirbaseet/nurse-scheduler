"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DefaultScheduleTab } from "./default-schedule-tab";
import { WeeklyOverridesTab } from "./weekly-overrides-tab";
import { useTranslation } from "@/i18n/use-translation";
import type { ClinicWithDefaults } from "@/types/clinic";

export function ClinicsConfig({ clinics }: { clinics: ClinicWithDefaults[] }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("clinics")}</h1>
      <Tabs defaultValue="defaults" dir="rtl">
        <TabsList>
          <TabsTrigger value="defaults">{t("default_schedule")}</TabsTrigger>
          <TabsTrigger value="overrides">{t("weekly_overrides")}</TabsTrigger>
        </TabsList>
        <TabsContent value="defaults">
          <DefaultScheduleTab clinics={clinics} />
        </TabsContent>
        <TabsContent value="overrides">
          <WeeklyOverridesTab clinics={clinics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
