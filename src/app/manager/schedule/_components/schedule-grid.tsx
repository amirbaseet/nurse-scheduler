"use client";

import { Fragment, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { cn, DAY_ORDER, formatDayDate } from "@/lib/utils";
import type { ScheduleAssignment } from "@/types/schedule";
import { ScheduleCell } from "./schedule-cell";
import { useTranslation } from "@/i18n/use-translation";

type NurseInfo = {
  id: string;
  name: string;
  contractHours: number;
  shiftPref: "MORNING" | "AFTERNOON" | "ANYTIME";
};

type NurseRow = {
  nurseId: string;
  name: string;
  contractHours: number;
  shiftPref: "MORNING" | "AFTERNOON" | "ANYTIME";
  days: Map<string, ScheduleAssignment>;
  totalHours: number;
  notes: string[];
};

function buildGrid(
  assignments: ScheduleAssignment[],
  nurseMap: Map<string, NurseInfo>,
): NurseRow[] {
  const rowMap = new Map<string, NurseRow>();

  for (const a of assignments) {
    if (!rowMap.has(a.nurseId)) {
      const info = nurseMap.get(a.nurseId);
      rowMap.set(a.nurseId, {
        nurseId: a.nurseId,
        name: a.nurse.user.name,
        contractHours: info?.contractHours ?? 0,
        shiftPref: info?.shiftPref ?? "ANYTIME",
        days: new Map(),
        totalHours: 0,
        notes: [],
      });
    }
    const row = rowMap.get(a.nurseId)!;
    row.days.set(a.day, a);
    if (!a.isOff) {
      row.totalHours += a.hours;
    }
    if (a.notes && !row.notes.includes(a.notes)) {
      row.notes.push(a.notes);
    }
  }

  return Array.from(rowMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "he"),
  );
}

function isDraggable(assignment: ScheduleAssignment | undefined): boolean {
  if (!assignment) return false;
  return !assignment.isOff && !assignment.isFixed;
}

// --- Draggable + Droppable clinic-row cell (drag + drop) ---
function DndClinicCell({
  assignment,
  nurseShiftPref,
  onClick,
  activeId,
}: {
  assignment: ScheduleAssignment | undefined;
  nurseShiftPref?: "MORNING" | "AFTERNOON" | "ANYTIME";
  onClick: () => void;
  activeId: string | null;
}) {
  const canDrag = isDraggable(assignment);
  const id = assignment?.id ?? "";

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
  } = useDraggable({
    id,
    disabled: !canDrag,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id,
    disabled: !assignment || assignment.isOff || assignment.isFixed,
  });

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      className={cn(
        isOver && activeId && activeId !== id && "ring-2 ring-primary rounded",
      )}
    >
      <ScheduleCell
        assignment={assignment ?? null}
        nurseShiftPref={nurseShiftPref}
        onClick={onClick}
        isDragging={activeId === id}
        variant="clinic"
      />
    </div>
  );
}

// --- Droppable-only hours-row cell ---
function DndHoursCell({
  assignment,
  nurseShiftPref,
  onClick,
  activeId,
}: {
  assignment: ScheduleAssignment | undefined;
  nurseShiftPref?: "MORNING" | "AFTERNOON" | "ANYTIME";
  onClick: () => void;
  activeId: string | null;
}) {
  const id = assignment?.id ? `${assignment.id}-hours` : "";
  const baseId = assignment?.id ?? "";

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id,
    disabled: !assignment || assignment.isOff || assignment.isFixed,
  });

  return (
    <div
      ref={setDropRef}
      className={cn(
        isOver &&
          activeId &&
          activeId !== baseId &&
          "ring-2 ring-primary rounded",
      )}
    >
      <ScheduleCell
        assignment={assignment ?? null}
        nurseShiftPref={nurseShiftPref}
        onClick={onClick}
        isDragging={activeId === baseId}
        variant="hours"
      />
    </div>
  );
}

// --- Full day name keys ---
const DAY_FULL_KEYS: Record<string, string> = {
  SUN: "sun_full",
  MON: "mon_full",
  TUE: "tue_full",
  WED: "wed_full",
  THU: "thu_full",
  FRI: "fri_full",
  SAT: "sat_full",
};

// --- Main Grid ---

export function ScheduleGrid({
  assignments,
  nurseMap,
  weekStart,
  onCellClick,
  onSwap,
}: {
  assignments: ScheduleAssignment[];
  nurseMap: Map<string, NurseInfo>;
  weekStart: Date;
  onCellClick: (assignment: ScheduleAssignment) => void;
  onSwap: (sourceId: string, targetId: string) => void;
}) {
  const { t } = useTranslation();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] =
    useState<ScheduleAssignment | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const grid = buildGrid(assignments, nurseMap);

  const findAssignment = (id: string) =>
    assignments.find((a) => a.id === id) ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveId(id);
    setActiveAssignment(findAssignment(id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setActiveAssignment(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sourceId = String(active.id);
    // Strip -hours suffix from drop target
    const targetId = String(over.id).replace(/-hours$/, "");

    if (sourceId === targetId) return;

    const source = findAssignment(sourceId);
    const target = findAssignment(targetId);
    if (!source || !target) return;
    if (target.isOff || target.isFixed) return;

    onSwap(sourceId, targetId);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full border-collapse text-sm">
          <thead>
            {/* Row 1: Day names */}
            <tr className="border-b bg-muted/50">
              <th
                rowSpan={2}
                className="sticky start-0 z-10 bg-muted/50 min-w-[120px] border-e px-2 py-1.5 text-start font-semibold"
              >
                {t("role_nurse")}
              </th>
              <th
                rowSpan={2}
                className="min-w-[80px] border-e px-2 py-1.5 text-center font-semibold"
              >
                {/* label column header intentionally blank */}
              </th>
              {DAY_ORDER.map((day) => (
                <th
                  key={day}
                  className="min-w-[130px] border-e px-2 py-1 text-center font-semibold"
                >
                  {t(DAY_FULL_KEYS[day])}
                </th>
              ))}
              <th
                rowSpan={2}
                className="min-w-[100px] border-e px-2 py-1.5 text-center font-semibold"
              >
                {t("notes")}
              </th>
              <th
                rowSpan={2}
                className="min-w-[60px] px-2 py-1.5 text-center font-semibold"
              >
                {t("total_hours_label")}
              </th>
            </tr>
            {/* Row 2: Dates */}
            <tr className="border-b bg-muted/30">
              {DAY_ORDER.map((day, i) => (
                <th
                  key={`${day}-date`}
                  className="border-e px-2 py-1 text-center text-xs font-normal text-muted-foreground"
                >
                  {formatDayDate(weekStart, i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((nurse, nurseIdx) => {
              const isAlternate = nurseIdx % 2 === 1;
              const bgClass = isAlternate ? "bg-muted/20" : "";
              const notesText = nurse.notes.join(", ");

              return (
                <Fragment key={nurse.nurseId}>
                  {/* Clinic row */}
                  <tr className={cn("border-b-0", bgClass)}>
                    <td
                      rowSpan={2}
                      className={cn(
                        "sticky start-0 z-10 border-e px-2 py-1 align-middle",
                        bgClass || "bg-background",
                      )}
                    >
                      <div className="font-medium text-sm">{nurse.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {nurse.contractHours} {t("hours_short")}
                      </div>
                    </td>
                    <td className="border-e px-1 py-0.5 text-center text-xs text-muted-foreground whitespace-nowrap">
                      {t("clinic_doctor_label")}
                    </td>
                    {DAY_ORDER.map((day) => {
                      const a = nurse.days.get(day);
                      return (
                        <td key={day} className="border-e px-0.5 py-0.5">
                          <DndClinicCell
                            assignment={a}
                            nurseShiftPref={nurse.shiftPref}
                            onClick={() => a && onCellClick(a)}
                            activeId={activeId}
                          />
                        </td>
                      );
                    })}
                    <td
                      rowSpan={2}
                      className="border-e px-1 py-0.5 text-xs text-muted-foreground align-middle max-w-[120px]"
                    >
                      {notesText && (
                        <span className="line-clamp-2" title={notesText}>
                          {notesText}
                        </span>
                      )}
                    </td>
                    <td
                      rowSpan={2}
                      className="px-2 py-0.5 text-center font-medium tabular-nums align-middle"
                    >
                      {nurse.totalHours.toFixed(1)}
                    </td>
                  </tr>
                  {/* Hours row */}
                  <tr className={cn("border-b-2", bgClass)}>
                    <td className="border-e px-1 py-0.5 text-center text-xs text-muted-foreground whitespace-nowrap">
                      {t("hour_label")}
                    </td>
                    {DAY_ORDER.map((day) => {
                      const a = nurse.days.get(day);
                      return (
                        <td key={day} className="border-e px-0.5 py-0.5">
                          <DndHoursCell
                            assignment={a}
                            nurseShiftPref={nurse.shiftPref}
                            onClick={() => a && onCellClick(a)}
                            activeId={activeId}
                          />
                        </td>
                      );
                    })}
                    {/* notes + total handled by rowSpan from clinic row */}
                  </tr>
                </Fragment>
              );
            })}
            {grid.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="text-center text-muted-foreground py-8"
                >
                  {t("no_schedule_data")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drag overlay -- ghost cell following cursor */}
      <DragOverlay>
        {activeAssignment ? (
          <div className="opacity-80 shadow-xl rounded">
            <ScheduleCell assignment={activeAssignment} variant="combined" />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
