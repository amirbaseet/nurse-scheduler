"use client";

import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, DAY_ORDER } from "@/lib/utils";
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
      });
    }
    const row = rowMap.get(a.nurseId)!;
    row.days.set(a.day, a);
    if (!a.isOff) {
      row.totalHours += a.hours;
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

// -- Draggable + Droppable cell wrapper --

function DndCell({
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

  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
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
      className={cn(isOver && activeId && activeId !== id && "ring-2 ring-primary rounded")}
    >
      <ScheduleCell
        assignment={assignment ?? null}
        nurseShiftPref={nurseShiftPref}
        onClick={onClick}
        isDragging={activeId === id}
      />
    </div>
  );
}

// -- Main Grid --

export function ScheduleGrid({
  assignments,
  nurseMap,
  onCellClick,
  onSwap,
}: {
  assignments: ScheduleAssignment[];
  nurseMap: Map<string, NurseInfo>;
  onCellClick: (assignment: ScheduleAssignment) => void;
  onSwap: (sourceId: string, targetId: string) => void;
}) {
  const { t } = useTranslation();

  const DAY_LABELS: Record<string, string> = {
    SUN: t("sun_short"),
    MON: t("mon_short"),
    TUE: t("tue_short"),
    WED: t("wed_short"),
    THU: t("thu_short"),
    FRI: t("fri_short"),
    SAT: t("sat_short"),
  };

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] =
    useState<ScheduleAssignment | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const grid = buildGrid(assignments, nurseMap);

  // Find assignment by id for drag overlay
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
    const targetId = String(over.id);

    // Validate both are swappable
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky start-0 z-10 bg-background min-w-[140px]">
                {t("role_nurse")}
              </TableHead>
              {DAY_ORDER.map((day) => (
                <TableHead key={day} className="text-center min-w-[100px]">
                  {DAY_LABELS[day]}
                </TableHead>
              ))}
              <TableHead className="text-center min-w-[60px]">{t("total_hours_label")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grid.map((nurse) => (
              <TableRow key={nurse.nurseId}>
                <TableCell className="sticky start-0 z-10 bg-background">
                  <div className="font-medium">{nurse.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {nurse.contractHours} {t("hours_short")}
                  </div>
                </TableCell>
                {DAY_ORDER.map((day) => {
                  const a = nurse.days.get(day);
                  return (
                    <TableCell key={day} className="p-1">
                      <DndCell
                        assignment={a}
                        nurseShiftPref={nurse.shiftPref}
                        onClick={() => a && onCellClick(a)}
                        activeId={activeId}
                      />
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-medium tabular-nums">
                  {nurse.totalHours.toFixed(1)}
                </TableCell>
              </TableRow>
            ))}
            {grid.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground py-8"
                >
                  {t("no_schedule_data")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Drag overlay -- ghost cell following cursor */}
      <DragOverlay>
        {activeAssignment ? (
          <div className="opacity-80 shadow-xl rounded">
            <ScheduleCell assignment={activeAssignment} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
