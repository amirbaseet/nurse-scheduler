"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DefaultScheduleTab } from "./default-schedule-tab";
import { WeeklyOverridesTab } from "./weekly-overrides-tab";
import type { ClinicWithDefaults } from "@/types/clinic";

export function ClinicsConfig({ clinics }: { clinics: ClinicWithDefaults[] }) {
  return (
    <Tabs defaultValue="defaults" dir="rtl">
      <TabsList>
        <TabsTrigger value="defaults">תבנית ברירת מחדל</TabsTrigger>
        <TabsTrigger value="overrides">שינויים שבועיים</TabsTrigger>
      </TabsList>
      <TabsContent value="defaults">
        <DefaultScheduleTab clinics={clinics} />
      </TabsContent>
      <TabsContent value="overrides">
        <WeeklyOverridesTab clinics={clinics} />
      </TabsContent>
    </Tabs>
  );
}
