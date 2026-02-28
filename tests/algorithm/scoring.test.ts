import { describe, it, expect, beforeEach } from "vitest";
import { calculateScore, countAssignedDays } from "@/algorithm/scoring";
import type { PreferenceEntry } from "@/algorithm/types";
import {
  makeNurse,
  makeGrid,
  makeBudgets,
  makeClinicSlot,
  getCell,
  resetNurseCounter,
} from "./helpers";

describe("Scoring — calculateScore", () => {
  beforeEach(() => resetNurseCounter());

  it("morning-preference nurse scores higher for morning slot", () => {
    const morningNurse = makeNurse({
      id: "n1",
      userId: "u1",
      shiftPreference: "MORNING",
    });
    const afternoonNurse = makeNurse({
      id: "n2",
      userId: "u2",
      shiftPreference: "AFTERNOON",
    });
    const grid = makeGrid([morningNurse, afternoonNurse]);
    const budgets = makeBudgets([morningNurse, afternoonNurse]);

    const morningSlot = makeClinicSlot({
      shiftStart: "08:00",
      shiftEnd: "15:00",
    });

    const scoreMorning = calculateScore(
      morningNurse,
      morningSlot,
      grid,
      budgets,
      [],
    );
    const scoreAfternoon = calculateScore(
      afternoonNurse,
      morningSlot,
      grid,
      budgets,
      [],
    );

    // Morning nurse gets 350 (match) vs afternoon nurse gets 50 (mismatch)
    expect(scoreMorning).toBeGreaterThan(scoreAfternoon);
    // Difference should be exactly 300 (350 - 50), all else being equal
    expect(scoreMorning - scoreAfternoon).toBe(300);
  });

  it("ANYTIME preference scores between match and mismatch", () => {
    const anytimeNurse = makeNurse({
      id: "n1",
      userId: "u1",
      shiftPreference: "ANYTIME",
    });
    const matchNurse = makeNurse({
      id: "n2",
      userId: "u2",
      shiftPreference: "MORNING",
    });
    const mismatchNurse = makeNurse({
      id: "n3",
      userId: "u3",
      shiftPreference: "AFTERNOON",
    });
    const grid = makeGrid([anytimeNurse, matchNurse, mismatchNurse]);
    const budgets = makeBudgets([anytimeNurse, matchNurse, mismatchNurse]);

    const morningSlot = makeClinicSlot({ shiftStart: "08:00" });

    const sAnytime = calculateScore(
      anytimeNurse,
      morningSlot,
      grid,
      budgets,
      [],
    );
    const sMatch = calculateScore(matchNurse, morningSlot, grid, budgets, []);
    const sMismatch = calculateScore(
      mismatchNurse,
      morningSlot,
      grid,
      budgets,
      [],
    );

    expect(sMatch).toBeGreaterThan(sAnytime);
    expect(sAnytime).toBeGreaterThan(sMismatch);
  });

  it("nurse with more remaining budget scores higher (S_budget)", () => {
    const nurse1 = makeNurse({ id: "n1", userId: "u1", contractHours: 36 });
    const nurse2 = makeNurse({ id: "n2", userId: "u2", contractHours: 36 });
    const grid = makeGrid([nurse1, nurse2]);
    const budgets = makeBudgets([nurse1, nurse2]);

    // nurse2 already used some hours
    budgets.set("n2", 18); // 50% remaining

    const slot = makeClinicSlot();

    const score1 = calculateScore(nurse1, slot, grid, budgets, []);
    const score2 = calculateScore(nurse2, slot, grid, budgets, []);

    expect(score1).toBeGreaterThan(score2);
  });

  it("nurse with fewer assigned days scores higher (S_fair)", () => {
    const nurse1 = makeNurse({ id: "n1", userId: "u1" });
    const nurse2 = makeNurse({ id: "n2", userId: "u2" });
    const grid = makeGrid([nurse1, nurse2]);
    const budgets = makeBudgets([nurse1, nurse2]);

    // Assign nurse2 to 3 days already
    for (const day of ["MON", "TUE", "WED"] as const) {
      getCell(grid, "n2", day).status = "ASSIGNED";
    }

    const slot = makeClinicSlot({ day: "THU" });

    const score1 = calculateScore(nurse1, slot, grid, budgets, []);
    const score2 = calculateScore(nurse2, slot, grid, budgets, []);

    expect(score1).toBeGreaterThan(score2);
  });

  it("penalty applied when working on preferred day off", () => {
    const nurse = makeNurse({
      id: "n1",
      userId: "u1",
      shiftPreference: "MORNING",
    });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const slot = makeClinicSlot({ day: "SUN", shiftStart: "08:00" });
    const prefs: PreferenceEntry[] = [
      { nurseUserId: "u1", preferredDaysOff: ["SUN"] },
    ];

    const withPref = calculateScore(nurse, slot, grid, budgets, prefs);
    const withoutPref = calculateScore(nurse, slot, grid, budgets, []);

    // Should be 100 less due to day-off penalty
    expect(withoutPref - withPref).toBe(100);
  });

  it("total score is raw addition of sub-scores (no weight multiplication)", () => {
    const nurse = makeNurse({
      id: "n1",
      userId: "u1",
      shiftPreference: "MORNING",
      contractHours: 36,
      maxDaysPerWeek: 5,
    });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const slot = makeClinicSlot({ shiftStart: "08:00" });

    const score = calculateScore(nurse, slot, grid, budgets, []);

    // S_pref=350 (perfect match) + S_budget=250 (full budget) + S_hist=0 (no historical data for test IDs) + S_fair=150 (0 assigned days)
    expect(score).toBe(350 + 250 + 0 + 150);
  });
});

describe("Scoring — countAssignedDays", () => {
  beforeEach(() => resetNurseCounter());

  it("counts only ASSIGNED cells", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);

    getCell(grid, "n1", "MON").status = "ASSIGNED";
    getCell(grid, "n1", "WED").status = "ASSIGNED";
    getCell(grid, "n1", "FRI").status = "BLOCKED";

    expect(countAssignedDays(grid, "n1")).toBe(2);
  });
});
