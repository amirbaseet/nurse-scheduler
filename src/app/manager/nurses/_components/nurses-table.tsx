"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Plus, Eye, EyeOff } from "lucide-react";
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
import { CreateNurseDialog } from "./create-nurse-dialog";

const PERMANENT_SENTINEL = "1970-01-01T00:00:00.000Z";

export function NursesTable({ nurses }: { nurses: SerializedNurse[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const visibleNurses = showInactive
    ? nurses
    : nurses.filter((n) => n.user.isActive);

  const inactiveCount = nurses.filter((n) => !n.user.isActive).length;

  const SHIFT_LABELS: Record<string, string> = {
    MORNING: t("morning"),
    AFTERNOON: t("afternoon"),
    ANYTIME: t("anytime"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nurses")}</h1>
        <div className="flex gap-2">
          {inactiveCount > 0 && (
            <Button
              size="sm"
              variant={showInactive ? "default" : "outline"}
              onClick={() => setShowInactive((prev) => !prev)}
            >
              {showInactive ? (
                <EyeOff className="h-4 w-4 me-1" />
              ) : (
                <Eye className="h-4 w-4 me-1" />
              )}
              {t("show_inactive")} ({inactiveCount})
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 me-1" />
            {t("add_nurse")}
          </Button>
        </div>
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
            <TableHead>{t("status")}</TableHead>
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
          {visibleNurses.map((nurse) => {
            const permanentFixed = nurse.fixedAssignments
              .filter((fa) => fa.weekStart === PERMANENT_SENTINEL)
              .map((fa) => fa.clinic.name);

            return (
              <TableRow
                key={nurse.id}
                className={`cursor-pointer ${!nurse.user.isActive ? "opacity-50" : ""}`}
                onClick={() => router.push(`/manager/nurses/${nurse.id}`)}
              >
                <TableCell>
                  {nurse.user.isActive ? (
                    <Badge className="bg-green-100 text-green-700">
                      {t("active")}
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500">
                      {t("inactive")}
                    </Badge>
                  )}
                </TableCell>
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
