import { describe, it, expect, beforeEach } from "vitest";
import {
  buildDifficultyQueue,
  getCandidates,
  countFilledForSlot,
} from "@/algorithm/difficulty-queue";
import {
  makeNurse,
  makeGrid,
  makeBudgets,
  makeClinicSlot,
  getCell,
  resetNurseCounter,
} from "./helpers";

describe("Difficulty Queue — buildDifficultyQueue", () => {
  beforeEach(() => resetNurseCounter());

  it("slot with fewer candidates comes before slot with more candidates", () => {
    // Clinic A on SUN: only nurse1 is eligible (nurse2 blocked)
    // Clinic B on SUN: both nurses eligible
    const nurse1 = makeNurse({ id: "n1" });
    const nurse2 = makeNurse({ id: "n2", blockedClinicIds: ["clinic-A"] });
    const grid = makeGrid([nurse1, nurse2]);
    const budgets = makeBudgets([nurse1, nurse2]);

    const slotA = makeClinicSlot({
      clinicId: "clinic-A",
      day: "SUN",
      nursesNeeded: 1,
    });
    const slotB = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      nursesNeeded: 1,
    });

    const queue = buildDifficultyQueue(
      grid,
      [nurse1, nurse2],
      [slotA, slotB],
      budgets,
    );

    expect(queue).toHaveLength(2);
    // Harder slot (clinic-A, 1 candidate) should come first
    expect(queue[0].clinicId).toBe("clinic-A");
    expect(queue[0].candidateCount).toBe(1);
    expect(queue[1].clinicId).toBe("clinic-B");
    expect(queue[1].candidateCount).toBe(2);
  });

  it("already-filled slots are excluded from queue", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    // Pre-fill clinic-A on SUN
    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";

    const slot = makeClinicSlot({
      clinicId: "clinic-A",
      day: "SUN",
      nursesNeeded: 1,
    });

    const queue = buildDifficultyQueue(grid, [nurse], [slot], budgets);
    expect(queue).toHaveLength(0);
  });

  it("expands multi-nurse slots into separate entries", () => {
    const nurse1 = makeNurse({ id: "n1" });
    const nurse2 = makeNurse({ id: "n2" });
    const nurse3 = makeNurse({ id: "n3" });
    const grid = makeGrid([nurse1, nurse2, nurse3]);
    const budgets = makeBudgets([nurse1, nurse2, nurse3]);

    const slot = makeClinicSlot({
      clinicId: "clinic-A",
      day: "MON",
      nursesNeeded: 2,
    });

    const queue = buildDifficultyQueue(
      grid,
      [nurse1, nurse2, nurse3],
      [slot],
      budgets,
    );

    // 2 seats needed → 2 entries in queue
    expect(queue).toHaveLength(2);
    expect(queue[0].candidateCount).toBe(3);
  });
});

describe("Difficulty Queue — getCandidates", () => {
  beforeEach(() => resetNurseCounter());

  it("excludes blocked nurses and nurses with insufficient budget", () => {
    const nurse1 = makeNurse({ id: "n1", contractHours: 36 });
    const nurse2 = makeNurse({
      id: "n2",
      contractHours: 36,
      blockedClinicIds: ["clinic-A"],
    });
    const nurse3 = makeNurse({ id: "n3", contractHours: 2 }); // not enough hours
    const grid = makeGrid([nurse1, nurse2, nurse3]);
    const budgets = makeBudgets([nurse1, nurse2, nurse3]);

    const slot = makeClinicSlot({
      clinicId: "clinic-A",
      day: "SUN",
      shiftHours: 7,
    });

    const candidates = getCandidates(
      grid,
      [nurse1, nurse2, nurse3],
      slot,
      budgets,
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("n1");
  });

  it("excludes nurses who are not AVAILABLE on that day", () => {
    const nurse1 = makeNurse({ id: "n1" });
    const nurse2 = makeNurse({ id: "n2" });
    const grid = makeGrid([nurse1, nurse2]);
    const budgets = makeBudgets([nurse1, nurse2]);

    getCell(grid, "n2", "MON").status = "BLOCKED";

    const slot = makeClinicSlot({ clinicId: "clinic-A", day: "MON" });
    const candidates = getCandidates(grid, [nurse1, nurse2], slot, budgets);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("n1");
  });
});

describe("Difficulty Queue — countFilledForSlot", () => {
  beforeEach(() => resetNurseCounter());

  it("counts nurses assigned to a specific clinic on a specific day", () => {
    const nurse1 = makeNurse({ id: "n1" });
    const nurse2 = makeNurse({ id: "n2" });
    const grid = makeGrid([nurse1, nurse2]);

    const cell1 = getCell(grid, "n1", "MON");
    cell1.status = "ASSIGNED";
    cell1.primaryClinicId = "clinic-A";

    const cell2 = getCell(grid, "n2", "MON");
    cell2.status = "ASSIGNED";
    cell2.primaryClinicId = "clinic-B"; // different clinic

    expect(countFilledForSlot(grid, "clinic-A", "MON")).toBe(1);
    expect(countFilledForSlot(grid, "clinic-B", "MON")).toBe(1);
    expect(countFilledForSlot(grid, "clinic-A", "TUE")).toBe(0);
  });
});
