import { describe, it, expect, beforeEach } from "vitest";
import { layer5_secondary } from "@/algorithm/layers/5-secondary";
import {
  makeNurse,
  makeGrid,
  makeBudgets,
  makeClinicSlot,
  getCell,
  resetNurseCounter,
} from "../helpers";

describe("Layer 5 — Secondary Clinics", () => {
  beforeEach(() => resetNurseCounter());

  it("assigns secondary clinic when demand > 0", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    // Pre-assign nurse to primary clinic on SUN
    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;
    budgets.set("n1", 29);

    const secondarySlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse], [secondarySlot], budgets);

    expect(cell.secondaryClinicId).toBe("clinic-B");
    expect(cell.hours).toBe(9); // 7 + 2
    expect(budgets.get("n1")).toBe(27); // 29 - 2
  });

  it("does not assign secondary when demand exhausted", () => {
    const nurse1 = makeNurse({ id: "n1", contractHours: 36 });
    const nurse2 = makeNurse({ id: "n2", contractHours: 36 });
    const grid = makeGrid([nurse1, nurse2]);
    const budgets = makeBudgets([nurse1, nurse2]);

    // Both nurses assigned on SUN
    for (const id of ["n1", "n2"]) {
      const cell = getCell(grid, id, "SUN");
      cell.status = "ASSIGNED";
      cell.primaryClinicId = "clinic-A";
      cell.hours = 7;
      budgets.set(id, 29);
    }

    // Secondary slot with demand = 1 (only 1 nurse needed)
    const secondarySlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse1, nurse2], [secondarySlot], budgets);

    // First nurse gets secondary
    expect(getCell(grid, "n1", "SUN").secondaryClinicId).toBe("clinic-B");
    // Second nurse should NOT get it — demand exhausted
    expect(getCell(grid, "n2", "SUN").secondaryClinicId).toBeUndefined();
  });

  it("skips nurse blocked from secondary clinic", () => {
    const nurse = makeNurse({
      id: "n1",
      contractHours: 36,
      blockedClinicIds: ["clinic-B"],
    });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;
    budgets.set("n1", 29);

    const secondarySlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse], [secondarySlot], budgets);

    expect(cell.secondaryClinicId).toBeUndefined();
  });

  it("skips when nurse budget is insufficient for secondary hours", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 8 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;
    budgets.set("n1", 1); // only 1h left, secondary needs 2h

    const secondarySlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse], [secondarySlot], budgets);

    expect(cell.secondaryClinicId).toBeUndefined();
  });

  it("assigns max 1 secondary per nurse per day", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;
    budgets.set("n1", 29);

    const secSlot1 = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });
    const secSlot2 = makeClinicSlot({
      clinicId: "clinic-C",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse], [secSlot1, secSlot2], budgets);

    // Should only get first secondary, not both
    expect(cell.secondaryClinicId).toBe("clinic-B");
    expect(cell.hours).toBe(9); // 7 + 2, not 7 + 4
  });

  it("ignores non-secondary clinics", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;
    budgets.set("n1", 29);

    // canBeSecondary is not set (defaults to undefined/falsy)
    const nonSecondarySlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      nursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse], [nonSecondarySlot], budgets);

    expect(cell.secondaryClinicId).toBeUndefined();
  });
});
