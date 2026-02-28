import { describe, it, expect, beforeEach } from "vitest";
import { tryBacktrack } from "@/algorithm/backtrack";
import {
  makeNurse,
  makeGrid,
  makeBudgets,
  makeClinicSlot,
  getCell,
  resetNurseCounter,
} from "./helpers";

describe("Backtracking — tryBacktrack", () => {
  beforeEach(() => resetNurseCounter());

  it("recovers by swapping assigned nurse to failed slot", () => {
    // Setup:
    // nurse1 is assigned to clinic-A on SUN (not fixed).
    // nurse2 is AVAILABLE on SUN, can do clinic-A but is blocked from clinic-B.
    // clinic-B on SUN has 0 normal candidates (nurse2 blocked, nurse1 already assigned).
    // Backtrack should: move nurse1 to clinic-B, put nurse2 on clinic-A.
    const nurse1 = makeNurse({ id: "n1" });
    const nurse2 = makeNurse({ id: "n2", blockedClinicIds: ["clinic-B"] });
    const nurses = [nurse1, nurse2];
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);

    // Pre-assign nurse1 to clinic-A on SUN
    const cell1 = getCell(grid, "n1", "SUN");
    cell1.status = "ASSIGNED";
    cell1.primaryClinicId = "clinic-A";
    cell1.shiftStart = "08:00";
    cell1.shiftEnd = "15:00";
    cell1.hours = 7;
    budgets.set("n1", 36 - 7); // 29 remaining

    const failedSlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      shiftHours: 7,
      nursesNeeded: 1,
    });

    const recovered = tryBacktrack(grid, failedSlot, nurses, budgets);

    expect(recovered).toBe(true);

    // nurse1 should now be on clinic-B
    expect(getCell(grid, "n1", "SUN").primaryClinicId).toBe("clinic-B");
    expect(getCell(grid, "n1", "SUN").hours).toBe(7);

    // nurse2 should now be on clinic-A
    expect(getCell(grid, "n2", "SUN").status).toBe("ASSIGNED");
    expect(getCell(grid, "n2", "SUN").primaryClinicId).toBe("clinic-A");
    expect(getCell(grid, "n2", "SUN").hours).toBe(7);
  });

  it("updates budgets correctly after swap", () => {
    const nurse1 = makeNurse({ id: "n1", contractHours: 36 });
    const nurse2 = makeNurse({ id: "n2", contractHours: 36 });
    const nurses = [nurse1, nurse2];
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);

    // nurse1 assigned to clinic-A (6h)
    const cell1 = getCell(grid, "n1", "MON");
    cell1.status = "ASSIGNED";
    cell1.primaryClinicId = "clinic-A";
    cell1.shiftStart = "08:00";
    cell1.shiftEnd = "14:00";
    cell1.hours = 6;
    budgets.set("n1", 30); // 36 - 6

    // Failed slot: clinic-B (7h)
    const failedSlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "MON",
      shiftHours: 7,
      nursesNeeded: 1,
    });

    tryBacktrack(grid, failedSlot, nurses, budgets);

    // nurse1: was 30 (36-6), refund 6, deduct 7 → 29
    expect(budgets.get("n1")).toBe(29);
    // nurse2: was 36, deduct 6 (original slot hours) → 30
    expect(budgets.get("n2")).toBe(30);
  });

  it("does not swap fixed assignments", () => {
    const nurse1 = makeNurse({ id: "n1" });
    const nurse2 = makeNurse({ id: "n2" });
    const nurses = [nurse1, nurse2];
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);

    // nurse1 FIXED to clinic-A on SUN
    const cell1 = getCell(grid, "n1", "SUN");
    cell1.status = "ASSIGNED";
    cell1.primaryClinicId = "clinic-A";
    cell1.hours = 7;
    cell1.isFixed = true;
    budgets.set("n1", 29);

    // nurse2 blocked from clinic-B (so can't be direct candidate)
    // and also blocked from clinic-A (so can't replace nurse1)
    const nurse2Blocked = makeNurse({
      id: "n2",
      blockedClinicIds: ["clinic-A", "clinic-B"],
    });

    const failedSlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      shiftHours: 7,
      nursesNeeded: 1,
    });

    // nurse1 is fixed → can't swap, nurse2 blocked → can't replace
    const recovered = tryBacktrack(
      grid,
      failedSlot,
      [nurse1, nurse2Blocked],
      budgets,
    );

    expect(recovered).toBe(false);
    // nurse1 should remain on clinic-A
    expect(getCell(grid, "n1", "SUN").primaryClinicId).toBe("clinic-A");
  });

  it("respects FEMALE_ONLY on failed slot", () => {
    const maleNurse = makeNurse({ id: "n1", gender: "MALE" });
    const femaleNurse = makeNurse({ id: "n2", gender: "FEMALE" });
    const nurses = [maleNurse, femaleNurse];
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);

    // Male nurse assigned to clinic-A
    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;
    budgets.set("n1", 29);

    // Failed slot is FEMALE_ONLY
    const failedSlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      shiftHours: 7,
      nursesNeeded: 1,
      genderPref: "FEMALE_ONLY",
    });

    const recovered = tryBacktrack(grid, failedSlot, nurses, budgets);

    // Male nurse can't be moved to FEMALE_ONLY slot → no swap via male nurse
    // But female nurse is AVAILABLE, and can't replace male in clinic-A...
    // Actually: female nurse IS available, so male nurse can't go to failed slot (FEMALE_ONLY),
    // but backtrack iterates assigned cells. Only male is assigned. He can't go to FEMALE_ONLY.
    // So recovery fails.
    expect(recovered).toBe(false);
  });

  it("returns false when no swap is possible", () => {
    const nurse = makeNurse({ id: "n1", blockedClinicIds: ["clinic-B"] });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    // nurse assigned to clinic-A
    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;
    budgets.set("n1", 29);

    // No one can replace nurse at clinic-A, and nurse is blocked from clinic-B
    const failedSlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      shiftHours: 7,
      nursesNeeded: 1,
    });

    const recovered = tryBacktrack(grid, failedSlot, [nurse], budgets);
    expect(recovered).toBe(false);
  });
});
