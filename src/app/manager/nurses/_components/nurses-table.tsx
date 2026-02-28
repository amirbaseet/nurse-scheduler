"use client";

import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { SerializedNurse } from "@/types/nurse";
import { parseJsonArray } from "@/lib/json-arrays";

const SHIFT_LABELS: Record<string, string> = {
  MORNING: "בוקר",
  AFTERNOON: "אחה״צ",
  ANYTIME: "גמיש",
};

const PERMANENT_SENTINEL = "1970-01-01T00:00:00.000Z";

export function NursesTable({ nurses }: { nurses: SerializedNurse[] }) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>שם</TableHead>
          <TableHead>שעות חוזה</TableHead>
          <TableHead>העדפת משמרת</TableHead>
          <TableHead>שישי</TableHead>
          <TableHead>שבת</TableHead>
          <TableHead>מקס׳ ימים</TableHead>
          <TableHead>שיבוצים קבועים</TableHead>
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
              <TableCell className="font-medium">
                {nurse.user.name}
              </TableCell>
              <TableCell>{nurse.contractHours}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {SHIFT_LABELS[nurse.shiftPreference] ?? nurse.shiftPreference}
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
  );
}
