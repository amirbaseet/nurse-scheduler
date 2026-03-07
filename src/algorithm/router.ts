// ═══════════════════════════════════════════
// Algorithm Router — select V1 or V2
// ═══════════════════════════════════════════

import type { AlgorithmConfig, ScheduleResult } from "./types";
import type { AlgorithmVersion } from "./algorithm-options";
import { generateWeeklySchedule } from "./index";
import { generateWeeklyScheduleV2 } from "./v2/index";

export type { AlgorithmVersion };

export function runScheduleAlgorithm(
  version: AlgorithmVersion,
  weekStart: Date,
  config: AlgorithmConfig,
): ScheduleResult {
  switch (version) {
    case "v2-nurse-first":
      return generateWeeklyScheduleV2(weekStart, config);
    case "v1-clinic-first":
    default:
      return generateWeeklySchedule(weekStart, config);
  }
}
