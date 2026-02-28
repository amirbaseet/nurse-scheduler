/**
 * Correction-adjusted probabilities.
 *
 * Reads ScheduleCorrection records, groups by pattern, and computes
 * probability adjustments:
 *   - 3+ "swap" corrections removing nurse A from clinic X → P(X|A) *= 0.8
 *   - 3+ "swap" corrections adding nurse B to clinic Y   → P(Y|B) *= 1.2
 *
 * Adjustments are applied on top of the base probability matrix.
 */
import { db } from "@/lib/db";

/** Adjustment multiplier per (nurseId, clinicId) pair */
export type AdjustmentMap = Map<string, number>;

const CORRECTION_THRESHOLD = 3;
const DECREASE_FACTOR = 0.8;
const INCREASE_FACTOR = 1.2;

function adjustmentKey(nurseId: string, clinicId: string): string {
  return `${nurseId}::${clinicId}`;
}

/**
 * Load correction-based adjustments from the DB.
 * Groups corrections by (nurseId, clinicId) pattern and computes multipliers.
 *
 * Returns a Map of "nurseId::clinicId" → multiplier (default 1.0).
 * Multiplier < 1.0 means the algorithm should penalize this pairing.
 * Multiplier > 1.0 means the algorithm should favor this pairing.
 */
export async function loadCorrectionAdjustments(): Promise<AdjustmentMap> {
  const adjustments: AdjustmentMap = new Map();

  const corrections = await db.scheduleCorrection.findMany({
    select: {
      originalNurseId: true,
      originalClinicId: true,
      correctedNurseId: true,
      correctedClinicId: true,
      correctionType: true,
    },
  });

  if (corrections.length === 0) return adjustments;

  // Count removals: how many times nurse was removed from a clinic
  const removals = new Map<string, number>();
  // Count additions: how many times nurse was added to a clinic
  const additions = new Map<string, number>();

  for (const c of corrections) {
    if (c.correctionType === "swap" || c.correctionType === "change_clinic") {
      // Original nurse was removed from original clinic
      if (c.originalClinicId) {
        const rKey = adjustmentKey(c.originalNurseId, c.originalClinicId);
        removals.set(rKey, (removals.get(rKey) ?? 0) + 1);
      }

      // Corrected nurse was added to corrected clinic
      if (c.correctedNurseId && c.correctedClinicId) {
        const aKey = adjustmentKey(c.correctedNurseId, c.correctedClinicId);
        additions.set(aKey, (additions.get(aKey) ?? 0) + 1);
      }
    }
  }

  // Apply threshold: 3+ identical patterns trigger adjustment
  for (const [key, count] of Array.from(removals)) {
    if (count >= CORRECTION_THRESHOLD) {
      const current = adjustments.get(key) ?? 1.0;
      adjustments.set(key, current * DECREASE_FACTOR);
    }
  }

  for (const [key, count] of Array.from(additions)) {
    if (count >= CORRECTION_THRESHOLD) {
      const current = adjustments.get(key) ?? 1.0;
      adjustments.set(key, current * INCREASE_FACTOR);
    }
  }

  return adjustments;
}

/**
 * Apply correction adjustment to a base probability.
 * Returns the adjusted probability, clamped to [0, 1].
 */
export function applyAdjustment(
  baseProb: number,
  nurseId: string,
  clinicId: string,
  adjustments: AdjustmentMap,
): number {
  const key = adjustmentKey(nurseId, clinicId);
  const multiplier = adjustments.get(key);
  if (!multiplier) return baseProb;
  return Math.max(0, Math.min(1, baseProb * multiplier));
}
