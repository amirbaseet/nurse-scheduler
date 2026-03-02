"use client";

import { Lock, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleAssignment } from "@/types/schedule";
import { useTranslation } from "@/i18n/use-translation";

type ShiftPref = "MORNING" | "AFTERNOON" | "ANYTIME";
type CellVariant = "combined" | "clinic" | "hours";

function isMismatch(
  assignment: ScheduleAssignment,
  nurseShiftPref?: ShiftPref,
): boolean {
  if (!nurseShiftPref || nurseShiftPref === "ANYTIME") return false;
  if (!assignment.shiftStart) return false;

  const hour = parseInt(assignment.shiftStart.split(":")[0], 10);
  if (nurseShiftPref === "MORNING" && hour >= 13) return true;
  if (nurseShiftPref === "AFTERNOON" && hour < 13) return true;
  return false;
}

const TIME_OFF_STYLES: Record<string, string> = {
  SICK: "bg-red-50 border border-red-300 text-red-700",
  VACATION: "bg-amber-50 border border-amber-300 text-amber-700",
  PERSONAL: "bg-violet-50 border border-violet-300 text-violet-700",
  OFF_DAY: "bg-gray-100 text-muted-foreground",
};

const TIME_OFF_ICONS: Record<string, string> = {
  SICK: "\uD83E\uDD12", // 🤒
  VACATION: "\uD83C\uDFD6\uFE0F", // 🏖️
  PERSONAL: "\uD83D\uDC64", // 👤
  OFF_DAY: "\uD83D\uDCC5", // 📅
};

const TIME_OFF_LABEL_KEYS: Record<string, string> = {
  SICK: "type_sick",
  VACATION: "type_vacation",
  PERSONAL: "type_personal",
  OFF_DAY: "type_off_day",
};

function getCellStyle(
  assignment: ScheduleAssignment,
  nurseShiftPref?: ShiftPref,
  timeOffType?: string,
): string {
  if (assignment.isOff) {
    if (timeOffType && TIME_OFF_STYLES[timeOffType]) {
      return TIME_OFF_STYLES[timeOffType];
    }
    return "bg-gray-100 text-muted-foreground";
  }
  if (assignment.isManagerSelf) return "bg-purple-50 border border-purple-400";
  if (assignment.isFixed) return "bg-blue-50 border border-blue-500";
  if (isMismatch(assignment, nurseShiftPref))
    return "bg-orange-50 border border-orange-400";
  return "bg-green-50 border border-green-300";
}

function getCombinedClinicName(a: ScheduleAssignment): string {
  const primary = a.primaryClinic?.name ?? "";
  const secondary = a.secondaryClinic?.name;
  return secondary ? `${primary}+ ${secondary}` : primary;
}

export function ScheduleCell({
  assignment,
  nurseShiftPref,
  onClick,
  isDragging,
  variant = "combined",
  timeOffType,
}: {
  assignment: ScheduleAssignment | null;
  nurseShiftPref?: ShiftPref;
  onClick?: () => void;
  isDragging?: boolean;
  variant?: CellVariant;
  timeOffType?: string;
}) {
  const { t } = useTranslation();

  if (!assignment) {
    return (
      <div className="flex h-7 items-center justify-center text-muted-foreground text-xs">
        —
      </div>
    );
  }

  // --- clinic variant ---
  if (variant === "clinic") {
    if (assignment.isOff) {
      const icon = timeOffType ? TIME_OFF_ICONS[timeOffType] : undefined;
      const labelKey = timeOffType
        ? TIME_OFF_LABEL_KEYS[timeOffType]
        : undefined;
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onClick?.();
          }}
          className={cn(
            "flex h-7 items-center justify-center gap-0.5 rounded-t px-1 text-xs cursor-pointer",
            getCellStyle(assignment, undefined, timeOffType),
          )}
        >
          {icon && <span>{icon}</span>}
          {labelKey ? t(labelKey) : t("vacation_short")}
        </div>
      );
    }

    const clinicName = getCombinedClinicName(assignment);
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick?.();
        }}
        className={cn(
          "flex h-7 items-center gap-0.5 rounded-t px-1 text-xs cursor-pointer transition-shadow hover:shadow-md",
          getCellStyle(assignment, nurseShiftPref),
          isDragging && "opacity-50 shadow-lg",
        )}
      >
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
    );
  }

  // --- hours variant ---
  if (variant === "hours") {
    if (assignment.isOff || !assignment.shiftStart || !assignment.shiftEnd) {
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onClick?.();
          }}
          className={cn(
            "flex h-7 items-center justify-center rounded-b px-1 text-xs cursor-pointer",
            getCellStyle(assignment, undefined, timeOffType),
          )}
        >
          —
        </div>
      );
    }

    const time = `${assignment.shiftStart}–${assignment.shiftEnd}`;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick?.();
        }}
        className={cn(
          "flex h-7 items-center justify-center rounded-b px-1 text-xs cursor-pointer transition-shadow hover:shadow-md",
          getCellStyle(assignment, nurseShiftPref),
          isDragging && "opacity-50 shadow-lg",
        )}
      >
        <span className="text-[11px] text-muted-foreground">{time}</span>
      </div>
    );
  }

  // --- combined variant (default, used for drag overlay) ---
  if (assignment.isOff) {
    const icon = timeOffType ? TIME_OFF_ICONS[timeOffType] : undefined;
    const labelKey = timeOffType ? TIME_OFF_LABEL_KEYS[timeOffType] : undefined;
    return (
      <div
        className={cn(
          "flex h-14 items-center justify-center gap-1 rounded px-1 py-0.5 text-xs",
          getCellStyle(assignment, undefined, timeOffType),
        )}
      >
        {icon && <span>{icon}</span>}
        {labelKey ? t(labelKey) : t("off_day")}
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
      {time && <div className="text-[10px] text-muted-foreground">{time}</div>}
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
