// ═══════════════════════════════════════════
// Algorithm Router — select V1 or V2
// Optionally runs Shift Builder pre-phase
// ═══════════════════════════════════════════

import type { AlgorithmConfig, ScheduleResult } from "./types";
import type { AlgorithmVersion, ShiftBuilderMode } from "./algorithm-options";
import { generateWeeklySchedule } from "./index";
import { generateWeeklyScheduleV2 } from "./v2/index";
import { buildShiftVariants } from "./shift-builder";

export type { AlgorithmVersion, ShiftBuilderMode };

export function runScheduleAlgorithm(
  version: AlgorithmVersion,
  weekStart: Date,
  config: AlgorithmConfig,
  shiftBuilder?: ShiftBuilderMode,
): ScheduleResult {
  // Optionally run shift builder to split long shifts for part-time nurses
  const effectiveConfig =
    shiftBuilder === "on"
      ? { ...config, clinics: buildShiftVariants(config.clinics, config.nurses) }
      : config;

  switch (version) {
    case "v2-nurse-first":
      return generateWeeklyScheduleV2(weekStart, effectiveConfig);
    case "v1-clinic-first":
    default:
      return generateWeeklySchedule(weekStart, effectiveConfig);
  }
}
