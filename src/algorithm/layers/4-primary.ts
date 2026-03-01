import type {
  Grid,
  AlgoNurse,
  ClinicSlot,
  Budgets,
  PreferenceEntry,
  Warning,
} from "../types";
import type { AdjustmentMap } from "../../learning/corrections";
import { applyAdjustment } from "../../learning/corrections";
import { getProb, getDayAffinity } from "../../learning/models";
import { calculateScore } from "../scoring";
import {
  buildDifficultyQueue,
  getCandidates,
  countFilledForSlot,
} from "../difficulty-queue";
import { checkLookAhead } from "../look-ahead";
import { tryBacktrack } from "../backtrack";

/** Confidence threshold: auto-assign without scoring when P > this value. */
const CONFIDENCE_THRESHOLD = 0.5;

/** Specialist threshold: near-exclusive pairings auto-assigned first. */
const SPECIALIST_THRESHOLD = 0.85;

/**
 * Layer 4: Fill all primary clinic slots (core logic).
 *
 * Two-pass approach:
 * 1. **Fast path** — auto-assign high-confidence pairings (P > 0.7)
 * 2. **Full scoring** — difficulty queue + MCV heuristic + look-ahead + backtrack
 *
 * Processes only genderPref=ANY (or undefined) slots — gender-restricted
 * slots were already handled by Layer 3.
 */
export function layer4_primary(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  budgets: Budgets,
  preferences: PreferenceEntry[],
  warnings: Warning[],
  adjustments?: AdjustmentMap,
): void {
  // Only process non-gender-restricted slots
  const anyGenderClinics = clinics.filter(
    (c) => !c.genderPref || c.genderPref === "ANY",
  );

  // ── Pass 0: Specialist auto-assign (P > 0.85) ──
  // Near-exclusive nurse-clinic pairings get assigned first, before anything else.
  specialistAutoAssign(grid, nurses, anyGenderClinics, budgets, adjustments);

  // ── Pass 1: Global affinity pre-assignment ──
  // For each nurse×day, find their #1 clinic and assign if probability is strong.
  // This is NURSE-first (not CLINIC-first) so it respects day-level patterns.
  affinityPreAssign(grid, nurses, anyGenderClinics, budgets);

  // ── Pass 2: Confidence fast path ──
  // Auto-assign when historical data shows P > 0.5
  confidenceFastPath(grid, nurses, anyGenderClinics, budgets, adjustments);

  // ── Pass 3: Full scoring for remaining unfilled slots ──
  const queue = buildDifficultyQueue(grid, nurses, anyGenderClinics, budgets);

  for (const slot of queue) {
    const candidates = getCandidates(grid, nurses, slot, budgets);

    if (candidates.length === 0) {
      const recovered = tryBacktrack(grid, slot, nurses, budgets);
      if (!recovered) {
        warnings.push({
          level: "error",
          message: `לא ניתן לאייש משבצת: אין מועמדות זמינות`,
          clinicId: slot.clinicId,
          day: slot.day,
        });
      }
      continue;
    }

    // Score each candidate: base score + look-ahead bonus
    const scored = candidates.map((nurse) => ({
      nurse,
      score:
        calculateScore(nurse, slot, grid, budgets, preferences, adjustments) +
        checkLookAhead(grid, nurse, slot, queue, nurses, budgets),
    }));

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0].nurse;

    assignNurse(grid, best, slot, budgets);
  }
}

/**
 * Pass 0: Auto-assign specialist nurses (P > 0.85).
 * These are near-exclusive pairings where the nurse works the same clinic
 * almost every week. Assigned before anything else to lock in ownership.
 */
function specialistAutoAssign(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  budgets: Budgets,
  adjustments?: AdjustmentMap,
): void {
  for (const slot of clinics) {
    const filled = countFilledForSlot(grid, slot.clinicId, slot.day);
    const remaining = slot.nursesNeeded - filled;
    if (remaining <= 0) continue;

    const candidates = getCandidates(grid, nurses, slot, budgets);
    if (candidates.length === 0) continue;

    const specialists = candidates
      .map((nurse) => {
        let prob = getProb(nurse.id, slot.clinicId, slot.day);
        if (adjustments) {
          prob = applyAdjustment(prob, nurse.id, slot.clinicId, adjustments);
        }
        return { nurse, prob };
      })
      .filter((c) => c.prob > SPECIALIST_THRESHOLD)
      .sort((a, b) => b.prob - a.prob);

    const toAssign = Math.min(remaining, specialists.length);
    for (let i = 0; i < toAssign; i++) {
      assignNurse(grid, specialists[i].nurse, slot, budgets);
    }
  }
}

/** Minimum probability for affinity pre-assignment. */
const AFFINITY_THRESHOLD = 0.3;

/**
 * Global affinity pre-assignment: NURSE-first approach.
 *
 * For each nurse on each available day, find their #1 historical clinic.
 * Collect all (nurse, day, clinic, prob) tuples, sort by probability
 * descending, and greedily assign. This ensures the strongest historical
 * pairings are locked in before the clinic-first difficulty queue runs.
 */
function affinityPreAssign(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  budgets: Budgets,
): void {
  // Build clinic slot lookup: "clinicId-day" → ClinicSlot
  const slotLookup = new Map<string, ClinicSlot>();
  for (const slot of clinics) {
    slotLookup.set(`${slot.clinicId}-${slot.day}`, slot);
  }

  // Collect all potential assignments
  type Candidate = {
    nurse: AlgoNurse;
    slot: ClinicSlot;
    prob: number;
  };
  const candidates: Candidate[] = [];

  for (const nurse of nurses) {
    const dayMap = grid.get(nurse.id);
    if (!dayMap) continue;

    for (const [day, cell] of Array.from(dayMap)) {
      if (cell.status !== "AVAILABLE") continue;
      if ((budgets.get(nurse.id) ?? 0) <= 0) continue;

      // Get this nurse's ranked clinics for this day
      const ranked = getDayAffinity(nurse.id, day);
      if (ranked.length === 0) continue;

      // Take the top clinic if above threshold
      const top = ranked[0];
      if (top.prob < AFFINITY_THRESHOLD) continue;

      // Check if a matching clinic slot exists and needs nurses
      const slot = slotLookup.get(`${top.clinicId}-${day}`);
      if (!slot) continue;

      // Check nurse isn't blocked from this clinic
      if (nurse.blockedClinicIds.includes(slot.clinicId)) continue;

      candidates.push({ nurse, slot, prob: top.prob });
    }
  }

  // Sort by probability descending — strongest pairings first
  candidates.sort((a, b) => b.prob - a.prob);

  // Greedy assignment
  for (const { nurse, slot } of candidates) {
    const cell = grid.get(nurse.id)?.get(slot.day);
    if (!cell || cell.status !== "AVAILABLE") continue;
    if ((budgets.get(nurse.id) ?? 0) < slot.shiftHours) continue;

    // Check slot still needs nurses
    const filled = countFilledForSlot(grid, slot.clinicId, slot.day);
    if (filled >= slot.nursesNeeded) continue;

    assignNurse(grid, nurse, slot, budgets);
  }
}

/**
 * Fast path: for each unfilled slot, find candidates with P > 0.5
 * and auto-assign the highest-probability one without full scoring.
 *
 * Respects: availability, blocked clinics, budget (via getCandidates).
 */
function confidenceFastPath(
  grid: Grid,
  nurses: AlgoNurse[],
  clinics: ClinicSlot[],
  budgets: Budgets,
  adjustments?: AdjustmentMap,
): void {
  for (const slot of clinics) {
    const filled = countFilledForSlot(grid, slot.clinicId, slot.day);
    const remaining = slot.nursesNeeded - filled;
    if (remaining <= 0) continue;

    // Get eligible candidates
    const candidates = getCandidates(grid, nurses, slot, budgets);
    if (candidates.length === 0) continue;

    // Score by probability only, filter by threshold
    const highConf = candidates
      .map((nurse) => {
        let prob = getProb(nurse.id, slot.clinicId, slot.day);
        if (adjustments) {
          prob = applyAdjustment(prob, nurse.id, slot.clinicId, adjustments);
        }
        return { nurse, prob };
      })
      .filter((c) => c.prob > CONFIDENCE_THRESHOLD)
      .sort((a, b) => b.prob - a.prob);

    // Auto-assign up to the remaining seats
    const toAssign = Math.min(remaining, highConf.length);
    for (let i = 0; i < toAssign; i++) {
      assignNurse(grid, highConf[i].nurse, slot, budgets);
    }
  }
}

/** Assign a nurse to a clinic slot and deduct hours from budget. */
function assignNurse(
  grid: Grid,
  nurse: AlgoNurse,
  slot: ClinicSlot,
  budgets: Budgets,
): void {
  const cell = grid.get(nurse.id)?.get(slot.day);
  if (!cell) return;

  cell.status = "ASSIGNED";
  cell.primaryClinicId = slot.clinicId;
  cell.shiftStart = slot.shiftStart;
  cell.shiftEnd = slot.shiftEnd;
  cell.hours = slot.shiftHours;
  cell.isFixed = false;

  const current = budgets.get(nurse.id) ?? 0;
  budgets.set(nurse.id, current - slot.shiftHours);
}
