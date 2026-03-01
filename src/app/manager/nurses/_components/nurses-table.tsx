"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import type { SerializedNurse } from "@/types/nurse";
import { parseJsonArray } from "@/lib/json-arrays";
import { CreateNurseDialog } from "./create-nurse-dialog";

const PERMANENT_SENTINEL = "1970-01-01T00:00:00.000Z";

export function NursesTable({ nurses }: { nurses: SerializedNurse[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);

  const SHIFT_LABELS: Record<string, string> = {
    MORNING: t("morning"),
    AFTERNOON: t("afternoon"),
    ANYTIME: t("anytime"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nurses")}</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 me-1" />
          {t("add_nurse")}
        </Button>
      </div>

      <CreateNurseDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          router.refresh();
        }}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("contract_hours")}</TableHead>
            <TableHead>{t("shift_preference")}</TableHead>
            <TableHead>{t("fri")}</TableHead>
            <TableHead>{t("sat")}</TableHead>
            <TableHead>{t("max_days_short")}</TableHead>
            <TableHead>{t("fixed_assignments")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nurses.map((nurse) => {
            const permanentFixed = nurse.fixedAssignments
              .filter((fa) => fa.weekStart === PERMANENT_SENTINEL)
              .map((fa) => fa.clinic.name);

            return (
              <TableRow
                key={nurse.id}
                className="cursor-pointer"
                onClick={() => router.push(`/manager/nurses/${nurse.id}`)}
              >
                <TableCell className="font-medium">{nurse.user.name}</TableCell>
                <TableCell>{nurse.contractHours}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {SHIFT_LABELS[nurse.shiftPreference] ??
                      nurse.shiftPreference}
                  </Badge>
                </TableCell>
                <TableCell>
                  {nurse.canWorkFriday ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell>
                  {nurse.canWorkSaturday ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell>{nurse.maxDaysPerWeek}</TableCell>
                <TableCell>
                  {permanentFixed.length > 0 ? (
                    <span className="text-sm">{permanentFixed.join(", ")}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
