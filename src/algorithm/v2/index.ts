// ═══════════════════════════════════════════
// V2: Nurse-First Scheduling Algorithm
// Entry point — same input/output as V1
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
} from "../types";
import { calculateQualityScore } from "../scoring";

// Reuse shared layers from V1
import { layer1_block } from "../layers/1-block";
import { layer2_fixed } from "../layers/2-fixed";
import { layer3_gender } from "../layers/3-gender";
import { layer5_secondary } from "../layers/5-secondary";
import { layer6_programs } from "../layers/6-programs";
import { layer7_gapFill } from "../layers/7-gap-fill";
import { layer8_offDays } from "../layers/8-off-days";
import { layer9_optimize } from "../layers/9-optimize";

// V2-specific layers
import { nurseFirstAssign } from "./nurse-first-assign";
import { clinicGapFill } from "./clinic-gap-fill";

const DAYS: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * V2: Nurse-First Weekly Schedule Generator
 *
 * Instead of filling clinic slots (V1), this algorithm:
 * 1. Calculates each nurse's daily hour target (contractHours / workDays)
 * 2. Assigns nurses day-by-day to their best-matching clinics
 * 3. Fills remaining clinic gaps afterwards
 *
 * Shared with V1: Layers 1, 2, 3, 5, 6, 7, 8, 9
 * New in V2: nurse-first-assign (replaces V1 Layer 4) + clinic-gap-fill
 */
export function generateWeeklyScheduleV2(
  _weekStart: Date,
  config: AlgorithmConfig,
): ScheduleResult {
  const warnings: Warning[] = [];

  // Filter out the manager
  const regularNurses = config.nurses.filter((n) => !n.isManager);

  // Initialize grid + budgets (same as V1)
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

  // ── Shared pre-processing (same as V1) ──

  // Layer 1: Block unavailable days
  layer1_block(
    grid,
    regularNurses,
    config.timeOff,
    DAYS,
    _weekStart,
    warnings,
    config.preferences,
  );

  // Layer 2: Place fixed assignments + pure programs
  layer2_fixed(
    grid,
    regularNurses,
    config.fixedAssignments,
    config.programs,
    budgets,
    warnings,
  );

  // Layer 3: Fill gender-restricted clinic slots
  layer3_gender(
    grid,
    regularNurses,
    config.clinics,
    budgets,
    warnings,
    config.adjustments,
  );

  // ── V2-specific: Nurse-first assignment ──

  nurseFirstAssign(
    grid,
    regularNurses,
    config.clinics,
    budgets,
    config.preferences,
    warnings,
    config.adjustments,
  );

  // ── V2-specific: Fill remaining clinic gaps ──

  clinicGapFill(
    grid,
    regularNurses,
    config.clinics,
    budgets,
    config.preferences,
    warnings,
    config.adjustments,
  );

  // ── Shared post-processing (same as V1) ──

  // Layer 5: Stack secondary clinics
  layer5_secondary(grid, regularNurses, config.clinics);

  // Layer 6: Add patient call program addons
  layer6_programs(grid, regularNurses, config.programs, budgets, warnings);

  // Layer 7: Fill remaining hours budget
  layer7_gapFill(grid, regularNurses, budgets, warnings);

  // Layer 8: Mark remaining days as OFF
  layer8_offDays(grid, regularNurses);

  // Layer 9: Optimize via simulated annealing
  layer9_optimize(
    grid,
    regularNurses,
    config.clinics,
    budgets,
    config.preferences,
  );

  // ── Compute results (same as V1) ──

  const managerGaps = findUnfilledSlots(grid, config.clinics);
  const qualityScore = calculateQualityScore(
    grid,
    regularNurses,
    config.clinics,
    config.preferences,
  );
  const assignments = gridToAssignments(grid);

  return { assignments, warnings, qualityScore, managerGaps };
}

// ═══════════════════════════════════════════
// Helpers (same as V1 index.ts)
// ═══════════════════════════════════════════

function findUnfilledSlots(grid: Grid, clinics: ClinicSlot[]): Gap[] {
  const gaps: Gap[] = [];

  for (const slot of clinics) {
    const filled = countNursesAt(grid, slot.clinicId, slot.day);
    if (filled < slot.nursesNeeded) {
      for (let i = 0; i < slot.nursesNeeded - filled; i++) {
        gaps.push({
          clinicId: slot.clinicId,
          clinicName: slot.clinicId,
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

function countNursesAt(grid: Grid, clinicId: string, day: DayOfWeek): number {
  let count = 0;
  for (const [, dayMap] of Array.from(grid)) {
    const cell = dayMap.get(day);
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
