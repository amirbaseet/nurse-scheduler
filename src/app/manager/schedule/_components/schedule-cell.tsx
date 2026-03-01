"use client";

import { Lock, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleAssignment } from "@/types/schedule";

type ShiftPref = "MORNING" | "AFTERNOON" | "ANYTIME";

function isMismatch(
  assignment: ScheduleAssignment,
  nurseShiftPref?: ShiftPref,
): boolean {
  if (!nurseShiftPref || nurseShiftPref === "ANYTIME") return false;
  if (!assignment.shiftStart) return false;

  const hour = parseInt(assignment.shiftStart.split(":")[0], 10);
  // Morning = before 13:00, Afternoon = 13:00+
  if (nurseShiftPref === "MORNING" && hour >= 13) return true;
  if (nurseShiftPref === "AFTERNOON" && hour < 13) return true;
  return false;
}

function getCellStyle(
  assignment: ScheduleAssignment,
  nurseShiftPref?: ShiftPref,
): string {
  if (assignment.isOff) return "bg-gray-100 text-muted-foreground";
  if (assignment.isManagerSelf) return "bg-purple-50 border border-purple-400";
  if (assignment.isFixed) return "bg-blue-50 border border-blue-500";
  if (isMismatch(assignment, nurseShiftPref))
    return "bg-orange-50 border border-orange-400";
  return "bg-green-50 border border-green-300";
}

export function ScheduleCell({
  assignment,
  nurseShiftPref,
  onClick,
  isDragging,
}: {
  assignment: ScheduleAssignment | null;
  nurseShiftPref?: ShiftPref;
  onClick?: () => void;
  isDragging?: boolean;
}) {
  if (!assignment) {
    return (
      <div className="flex h-14 items-center justify-center text-muted-foreground">
        —
      </div>
    );
  }

  if (assignment.isOff) {
    return (
      <div
        className={cn(
          "flex h-14 items-center justify-center rounded px-1 py-0.5 text-xs",
          getCellStyle(assignment),
        )}
      >
        חופש
      </div>
    );
  }

  const clinicName = assignment.primaryClinic?.name ?? "—";
  const secondaryName = assignment.secondaryClinic?.name;
  const time =
    assignment.shiftStart && assignment.shiftEnd
      ? `${assignment.shiftStart}–${assignment.shiftEnd}`
      : "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
      className={cn(
        "relative min-h-14 cursor-pointer rounded px-1.5 py-1 text-xs transition-shadow hover:shadow-md",
        getCellStyle(assignment, nurseShiftPref),
        isDragging && "opacity-50 shadow-lg",
      )}
    >
      {/* Top row: clinic name + icons */}
      <div className="flex items-center gap-0.5">
        {assignment.isFixed && (
          <Lock className="h-3 w-3 shrink-0 text-blue-600" />
        )}
        <span className="truncate font-medium" title={clinicName}>
          {clinicName}
        </span>
        {assignment.notes && (
          <StickyNote className="h-3 w-3 shrink-0 text-amber-500 ms-auto" />
        )}
      </div>

      {/* Shift time */}
      {time && <div className="text-[10px] text-muted-foreground">{time}</div>}

      {/* Secondary clinic */}
      {secondaryName && (
        <div
          className="truncate text-[11px] font-medium text-blue-600"
          title={secondaryName}
        >
          + {secondaryName}
        </div>
      )}
    </div>
  );
}
