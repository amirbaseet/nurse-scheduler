import { describe, it, expect, beforeEach } from "vitest";
import { checkLookAhead } from "@/algorithm/look-ahead";
import {
  makeNurse,
  makeGrid,
  makeBudgets,
  makeClinicSlot,
  resetNurseCounter,
} from "./helpers";

describe("Look-Ahead — checkLookAhead", () => {
  beforeEach(() => resetNurseCounter());

  it("penalizes assignment that would leave a future slot with 0 candidates", () => {
    // Setup: 2 nurses, 2 slots on the same day (SUN).
    // Slot A and Slot B both need 1 nurse.
    // nurse1 can do both slots, nurse2 can ONLY do slot B (blocked from A).
    // If we assign nurse1 to slot B, slot A has 0 candidates → dead-end.
    const nurse1 = makeNurse({ id: "n1" });
    const nurse2 = makeNurse({ id: "n2", blockedClinicIds: ["clinic-A"] });
    const nurses = [nurse1, nurse2];
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);

    const slotA = makeClinicSlot({
      clinicId: "clinic-A",
      day: "SUN",
      shiftHours: 7,
      nursesNeeded: 1,
    });
    const slotB = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      shiftHours: 7,
      nursesNeeded: 1,
    });

    // Check: what if we assign nurse1 to slotB?
    // Future: slotA would have 0 candidates (nurse1 busy on SUN, nurse2 blocked)
    const bonus = checkLookAhead(
      grid,
      nurse1,
      slotB,
      [slotA, slotB],
      nurses,
      budgets,
    );

    // Should get -80 penalty (0 future candidates for slotA)
    expect(bonus).toBe(-80);
  });

  it("penalizes when future slot has only 1 candidate", () => {
    // 3 nurses, slot on MON needs 1 nurse.
    // If we assign nurse1 to a SUN slot, future MON slot has 2 candidates
    // left (nurse2, nurse3). That's fine (no penalty).
    // But if nurse3 is blocked from MON slot, only nurse2 remains → -30.
    const nurse1 = makeNurse({ id: "n1" });
    const nurse2 = makeNurse({ id: "n2" });
    const nurse3 = makeNurse({ id: "n3", blockedClinicIds: ["clinic-MON"] });
    const nurses = [nurse1, nurse2, nurse3];
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);

    const sunSlot = makeClinicSlot({
      clinicId: "clinic-SUN",
      day: "SUN",
      shiftHours: 7,
      nursesNeeded: 1,
    });
    const monSlot = makeClinicSlot({
      clinicId: "clinic-MON",
      day: "MON",
      shiftHours: 7,
      nursesNeeded: 1,
    });

    // Check: assigning nurse1 to sunSlot.
    // Future monSlot: nurse1 still available (different day), nurse2 available,
    // nurse3 blocked → 2 candidates. No penalty.
    const bonus = checkLookAhead(
      grid,
      nurse1,
      sunSlot,
      [sunSlot, monSlot],
      nurses,
      budgets,
    );

    // nurse1 available on MON + nurse2 available on MON = 2 candidates → no penalty
    expect(bonus).toBe(0);

    // Now block nurse1 from clinic-MON too
    const nurse1Blocked = makeNurse({
      id: "n1b",
      blockedClinicIds: ["clinic-MON"],
    });
    const nursesV2 = [nurse1Blocked, nurse2, nurse3];
    const gridV2 = makeGrid(nursesV2);
    const budgetsV2 = makeBudgets(nursesV2);

    // Now: future monSlot has only nurse2 → 1 candidate → -30
    const bonusV2 = checkLookAhead(
      gridV2,
      nurse1Blocked,
      sunSlot,
      [sunSlot, monSlot],
      nursesV2,
      budgetsV2,
    );

    expect(bonusV2).toBe(-30);
  });

  it("gives bonus when future slot has ≥4 candidates", () => {
    const nurses = Array.from({ length: 5 }, (_, i) =>
      makeNurse({ id: `n${i}` }),
    );
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);

    const sunSlot = makeClinicSlot({
      clinicId: "clinic-SUN",
      day: "SUN",
      shiftHours: 7,
      nursesNeeded: 1,
    });
    const monSlot = makeClinicSlot({
      clinicId: "clinic-MON",
      day: "MON",
      shiftHours: 7,
      nursesNeeded: 1,
    });

    // Assigning n0 to SUN; MON still has n0 (different day) + n1..n4 = 5 candidates
    const bonus = checkLookAhead(
      grid,
      nurses[0],
      sunSlot,
      [sunSlot, monSlot],
      nurses,
      budgets,
    );

    // ≥4 candidates → +10
    expect(bonus).toBe(10);
  });

  it("clamps total bonus to [-100, +100]", () => {
    // Create a scenario with multiple future slots all having 0 candidates
    // 1 nurse, 3 future slots the nurse can't reach (same day as current slot)
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const currentSlot = makeClinicSlot({
      clinicId: "clinic-0",
      day: "SUN",
      shiftHours: 7,
      nursesNeeded: 1,
    });

    // 3 future slots all on SUN — nurse can't be on two SUN slots
    const futureSlots = [1, 2, 3].map((i) =>
      makeClinicSlot({
        clinicId: `clinic-${i}`,
        day: "SUN",
        shiftHours: 7,
        nursesNeeded: 1,
      }),
    );

    const allSlots = [currentSlot, ...futureSlots];
    const bonus = checkLookAhead(
      grid,
      nurse,
      currentSlot,
      allSlots,
      [nurse],
      budgets,
    );

    // 3 × -80 = -240, but clamped to -100
    expect(bonus).toBe(-100);
  });

  it("accounts for reduced budget when checking future slots", () => {
    // Nurse has 10h budget. Current slot costs 7h. Future slot costs 7h.
    // After current assignment, temp budget = 3h < 7h → can't do future slot.
    const nurse = makeNurse({ id: "n1", contractHours: 10 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const sunSlot = makeClinicSlot({
      clinicId: "clinic-SUN",
      day: "SUN",
      shiftHours: 7,
      nursesNeeded: 1,
    });
    const monSlot = makeClinicSlot({
      clinicId: "clinic-MON",
      day: "MON",
      shiftHours: 7,
      nursesNeeded: 1,
    });

    // After assigning nurse to SUN (7h), tempBudget = 3h < 7h for MON
    // 0 candidates for MON → -80
    const bonus = checkLookAhead(
      grid,
      nurse,
      sunSlot,
      [sunSlot, monSlot],
      [nurse],
      budgets,
    );

    expect(bonus).toBe(-80);
  });
});
