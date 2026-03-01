"use client";

import { useState } from "react";
import { ChevronDown, AlertTriangle, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTranslation } from "@/i18n/use-translation";
import type { UnfilledSlot, NurseRemaining } from "./schedule-gaps";

const DAY_KEYS: Record<string, string> = {
  SUN: "sun",
  MON: "mon",
  TUE: "tue",
  WED: "wed",
  THU: "thu",
  FRI: "fri",
  SAT: "sat",
};

type Props = {
  unfilledSlots: UnfilledSlot[];
  nurseRemaining: NurseRemaining[];
};

export function ScheduleSummaryPanels({
  unfilledSlots,
  nurseRemaining,
}: Props) {
  const { t } = useTranslation();
  const [slotsOpen, setSlotsOpen] = useState(true);
  const [nursesOpen, setNursesOpen] = useState(true);

  const totalGaps = unfilledSlots.reduce((sum, s) => sum + s.gap, 0);
  const totalRemainingHours = nurseRemaining.reduce(
    (sum, n) => sum + n.remainingHours,
    0,
  );

  // Group unfilled slots by day for cleaner display
  const slotsByDay = new Map<string, UnfilledSlot[]>();
  for (const slot of unfilledSlots) {
    const existing = slotsByDay.get(slot.day) ?? [];
    slotsByDay.set(slot.day, [...existing, slot]);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Panel 1: Unfilled clinic slots */}
      <Collapsible open={slotsOpen} onOpenChange={setSlotsOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-sm">
                  {t("unfilled_clinic_slots")}
                </span>
                {totalGaps > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {totalGaps}
                  </Badge>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  slotsOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              {unfilledSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("no_unfilled_slots")}
                </p>
              ) : (
                <div className="space-y-3">
                  {Array.from(slotsByDay.entries()).map(([day, slots]) => (
                    <div key={day}>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {t(DAY_KEYS[day] ?? day)}
                      </p>
                      <div className="grid gap-1">
                        {slots.map((slot) => (
                          <div
                            key={`${slot.clinicId}-${slot.day}`}
                            className="flex items-center justify-between text-sm bg-orange-50 dark:bg-orange-950/20 rounded px-3 py-1.5"
                          >
                            <span>{slot.clinicName}</span>
                            <span className="text-xs text-muted-foreground">
                              {slot.nursesAssigned}/{slot.nursesNeeded}{" "}
                              <span className="text-orange-600 font-medium">
                                (-{slot.gap})
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Panel 2: Nurses with remaining hours */}
      <Collapsible open={nursesOpen} onOpenChange={setNursesOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">
                  {t("nurses_with_remaining")}
                </span>
                {nurseRemaining.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {nurseRemaining.length}
                  </Badge>
                )}
                {totalRemainingHours > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({totalRemainingHours} {t("hours_short")})
                  </span>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  nursesOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              {nurseRemaining.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("no_remaining_nurses")}
                </p>
              ) : (
                <div className="grid gap-1">
                  {nurseRemaining.map((nurse) => (
                    <div
                      key={nurse.nurseId}
                      className="flex items-center justify-between text-sm bg-blue-50 dark:bg-blue-950/20 rounded px-3 py-1.5"
                    >
                      <span>{nurse.nurseName}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {nurse.assignedHours}/{nurse.contractHours}{" "}
                          {t("hours_short")}
                        </span>
                        <span className="text-blue-600 font-medium">
                          {t("remaining_label")}: {nurse.remainingHours}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
