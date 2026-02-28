// ═══════════════════════════════════════════
// Scheduling Algorithm — Main Entry Point
// ═══════════════════════════════════════════

import type {
  AlgorithmConfig,
  ScheduleResult,
  Grid,
  Cell,
  Budgets,
  Warning,
  Gap,
  DayOfWeek,
  ClinicSlot,
  AssignmentData,
} from "./types";

import { layer1_block } from "./layers/1-block";
import { layer2_fixed } from "./layers/2-fixed";
import { layer3_gender } from "./layers/3-gender";
import { layer4_primary } from "./layers/4-primary";
import { layer5_secondary } from "./layers/5-secondary";
import { layer6_programs } from "./layers/6-programs";
import { layer7_gapFill } from "./layers/7-gap-fill";
import { layer8_offDays } from "./layers/8-off-days";
import { layer9_optimize } from "./layers/9-optimize";

const DAYS: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// ═══════════════════════════════════════════
// Main entry — generates a full week schedule
// ═══════════════════════════════════════════

export function generateWeeklySchedule(
  _weekStart: Date,
  config: AlgorithmConfig,
): ScheduleResult {
  const warnings: Warning[] = [];

  // Filter out the manager — she self-schedules after
  const regularNurses = config.nurses.filter((n) => !n.isManager);

  // Initialize grid + budgets
  const grid: Grid = new Map();
  const budgets: Budgets = new Map();

  for (const nurse of regularNurses) {
    budgets.set(nurse.id, nurse.contractHours);

    const dayMap = new Map<DayOfWeek, Cell>();
    for (const day of DAYS) {
      dayMap.set(day, {
        status: "AVAILABLE",
        hours: 0,
        isFixed: false,
        isManagerSelf: false,
      });
    }
    grid.set(nurse.id, dayMap);
  }

  // Execute 9 layers
  layer1_block(grid, regularNurses, config.timeOff, DAYS, _weekStart, warnings);
  layer2_fixed(
    grid,
    regularNurses,
    config.fixedAssignments,
    config.programs,
    budgets,
    warnings,
  );
  layer3_gender(grid, regularNurses, config.clinics, budgets, warnings);
  layer4_primary(
    grid,
    regularNurses,
    config.clinics,
    budgets,
    config.preferences,
    warnings,
  );
  layer5_secondary(grid, regularNurses, config.clinics, budgets);
  layer6_programs(grid, regularNurses, config.programs, budgets, warnings);
  layer7_gapFill(grid, regularNurses, budgets, warnings);
  layer8_offDays(grid, regularNurses);
  layer9_optimize(
    grid,
    regularNurses,
    config.clinics,
    budgets,
    config.preferences,
  );

  // Compute results
  const managerGaps = findUnfilledSlots(grid, config.clinics);
  const qualityScore = calculateQuality(
    grid,
    config.clinics,
    config.preferences,
  );
  const assignments = gridToAssignments(grid);

  return { assignments, warnings, qualityScore, managerGaps };
}

// ═══════════════════════════════════════════
// Find unfilled clinic slots (manager gaps)
// ═══════════════════════════════════════════

function findUnfilledSlots(grid: Grid, clinics: ClinicSlot[]): Gap[] {
  const gaps: Gap[] = [];

  for (const slot of clinics) {
    const filled = countNursesAt(grid, slot.clinicId, slot.day);
    if (filled < slot.nursesNeeded) {
      for (let i = 0; i < slot.nursesNeeded - filled; i++) {
        gaps.push({
          clinicId: slot.clinicId,
          clinicName: slot.clinicId, // Will be enriched by caller
          day: slot.day,
          shiftStart: slot.shiftStart,
          shiftEnd: slot.shiftEnd,
          hours: slot.shiftHours,
        });
      }
    }
  }

  return gaps;
}

// ═══════════════════════════════════════════
// Quality Score (0-100)
// ═══════════════════════════════════════════

function calculateQuality(
  grid: Grid,
  clinics: ClinicSlot[],
  _preferences: AlgorithmConfig["preferences"],
): number {
  let score = 100.0;

  // -10 per unfilled required clinic slot
  for (const slot of clinics) {
    const filled = countNursesAt(grid, slot.clinicId, slot.day);
    if (filled < slot.nursesNeeded) {
      score -= 10 * (slot.nursesNeeded - filled);
    }
  }

  // Layers are stubs, so for now just deduct for unfilled slots
  return Math.max(0, Math.round(score));
}

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

function countNursesAt(grid: Grid, clinicId: string, day: DayOfWeek): number {
  let count = 0;
  for (const [, days] of Array.from(grid)) {
    const cell = days.get(day);
    if (
      cell &&
      cell.status === "ASSIGNED" &&
      cell.primaryClinicId === clinicId
    ) {
      count++;
    }
  }
  return count;
}

function gridToAssignments(grid: Grid): AssignmentData[] {
  const results: AssignmentData[] = [];

  for (const [nurseId, days] of Array.from(grid)) {
    for (const [day, cell] of Array.from(days)) {
      results.push({
        nurseId,
        day,
        primaryClinicId: cell.primaryClinicId ?? null,
        secondaryClinicId: cell.secondaryClinicId ?? null,
        shiftStart: cell.shiftStart ?? null,
        shiftEnd: cell.shiftEnd ?? null,
        hours: cell.hours,
        patientCallProgram: cell.patientCallProgram ?? null,
        patientCallCount: cell.patientCallCount ?? null,
        isOff: cell.status === "OFF",
        isFixed: cell.isFixed,
        isManagerSelf: cell.isManagerSelf,
      });
    }
  }

  return results;
}
