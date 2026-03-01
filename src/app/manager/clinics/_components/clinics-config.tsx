"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DefaultScheduleTab } from "./default-schedule-tab";
import { WeeklyOverridesTab } from "./weekly-overrides-tab";
import { CreateClinicDialog } from "./create-clinic-dialog";
import { useTranslation } from "@/i18n/use-translation";
import type { ClinicWithDefaults } from "@/types/clinic";

export function ClinicsConfig({ clinics }: { clinics: ClinicWithDefaults[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("clinics")}</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 me-1" />
          {t("add_clinic")}
        </Button>
      </div>

      <CreateClinicDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          router.refresh();
        }}
      />

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
