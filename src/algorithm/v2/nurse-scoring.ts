// ═══════════════════════════════════════════
// V2 Nurse-First Scoring
// Scores a clinic slot FROM THE NURSE'S perspective
// ═══════════════════════════════════════════

import type {
  AlgoNurse,
  ClinicSlot,
  Grid,
  Budgets,
  PreferenceEntry,
  DayOfWeek,
} from "../types";
import { getProb, getDayAffinity } from "../../learning/models";
import type { AdjustmentMap } from "../../learning/corrections";
import { applyAdjustment } from "../../learning/corrections";

/**
 * Score a clinic slot for a nurse (nurse-centric perspective).
 * Returns 0-1200 via RAW ADDITION.
 *
 * S_affinity (0-400) + S_hours (0-300) + S_pref (0-200)
 * + S_variety (0-100) + S_demand (0-200)
 */
export function scoreSlotForNurse(
  nurse: AlgoNurse,
  slot: ClinicSlot,
  dailyTarget: number,
  grid: Grid,
  budgets: Budgets,
  preferences: PreferenceEntry[],
  allSlots: ClinicSlot[],
  adjustments?: AdjustmentMap,
): number {
  const sAffinity = calcAffinityScore(nurse.id, slot, adjustments);
  const sHours = calcHoursMatchScore(slot.shiftHours, dailyTarget);
  const sPref = calcPreferenceScore(nurse, slot, preferences);
  const sVariety = calcVarietyScore(nurse.id, slot.clinicId, grid);
  const sDemand = calcDemandScore(slot, allSlots, grid);

  return sAffinity + sHours + sPref + sVariety + sDemand;
}

// ── S_affinity (0-400): Historical nurse-clinic match ──

function calcAffinityScore(
  nurseId: string,
  slot: ClinicSlot,
  adjustments?: AdjustmentMap,
): number {
  let prob = getProb(nurseId, slot.clinicId, slot.day);
  if (adjustments) {
    prob = applyAdjustment(prob, nurseId, slot.clinicId, adjustments);
  }

  // Base score from probability
  let score = Math.round(prob * 300);

  // Bonus if this is the nurse's #1 clinic for this day
  const ranked = getDayAffinity(nurseId, slot.day);
  if (ranked.length > 0 && ranked[0].clinicId === slot.clinicId) {
    score += 100; // Top-choice bonus
  }

  return Math.min(400, score);
}

// ── S_hours (0-300): How close is shift to daily target ──

function calcHoursMatchScore(
  shiftHours: number,
  dailyTarget: number,
): number {
  if (dailyTarget <= 0) return 150; // No target = neutral

  const diff = Math.abs(shiftHours - dailyTarget);

  if (diff === 0) return 300; // Perfect match
  if (diff <= 0.5) return 250; // Within 30 min
  if (diff <= 1) return 200; // Within 1 hour
  if (diff <= 2) return 100; // Within 2 hours
  return 30; // Poor match
}

// ── S_pref (0-200): Shift time preference match ──

function calcPreferenceScore(
  nurse: AlgoNurse,
  slot: ClinicSlot,
  preferences: PreferenceEntry[],
): number {
  const weeklyPref = preferences.find((p) => p.nurseUserId === nurse.userId);
  const pref = weeklyPref?.shiftPreference ?? nurse.shiftPreference;
  const shiftType = slot.shiftStart < "12:00" ? "MORNING" : "AFTERNOON";

  if (pref === shiftType) return 200; // Perfect match
  if (pref === "ANYTIME") return 150; // Flexible
  return 20; // Mismatch

  // Note: day-off penalty is handled at the filtering level in V2
  // (blocked days include preferred days off via Layer 1)
}

// ── S_variety (0-100): Penalize same clinic on multiple days ──

function calcVarietyScore(
  nurseId: string,
  clinicId: string,
  grid: Grid,
): number {
  const dayMap = grid.get(nurseId);
  if (!dayMap) return 100;

  // Count how many days this nurse is already assigned to this clinic
  let sameClinicDays = 0;
  for (const [, cell] of Array.from(dayMap)) {
    if (cell.status === "ASSIGNED" && cell.primaryClinicId === clinicId) {
      sameClinicDays++;
    }
  }

  // Encourage variety: 0 repeats = full score, each repeat loses 25
  return Math.max(0, 100 - sameClinicDays * 25);
}

// ── S_demand (0-200): How urgently does this clinic need nurses? ──

function calcDemandScore(
  slot: ClinicSlot,
  allSlots: ClinicSlot[],
  grid: Grid,
): number {
  // Count how many nurses are already assigned to this slot
  let filled = 0;
  for (const [, dayMap] of Array.from(grid)) {
    const cell = dayMap.get(slot.day);
    if (
      cell &&
      cell.status === "ASSIGNED" &&
      cell.primaryClinicId === slot.clinicId
    ) {
      filled++;
    }
  }

  const remaining = slot.nursesNeeded - filled;
  if (remaining <= 0) return 0; // Already fully staffed

  // Higher score for slots with more remaining demand
  const urgency = Math.min(remaining / slot.nursesNeeded, 1);
  return Math.round(urgency * 200);
}
