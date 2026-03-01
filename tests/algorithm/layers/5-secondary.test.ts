import { describe, it, expect, beforeEach, vi } from "vitest";
import { layer5_secondary } from "@/algorithm/layers/5-secondary";
import {
  makeNurse,
  makeGrid,
  makeClinicSlot,
  getCell,
  resetNurseCounter,
} from "../helpers";

// Mock learning models — returns null by default (no combo data)
vi.mock("@/learning/models", () => ({
  loadModels: vi.fn(() => null),
}));

import { loadModels } from "@/learning/models";

describe("Layer 5 — Secondary Clinics", () => {
  beforeEach(() => resetNurseCounter());

  it("assigns secondary clinic when demand > 0", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);

    // Pre-assign nurse to primary clinic on SUN
    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;

    const secondarySlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse], [secondarySlot]);

    expect(cell.secondaryClinicId).toBe("clinic-B");
    expect(cell.hours).toBe(7); // shift hours unchanged — secondary is within same shift
  });

  it("does not assign secondary when demand exhausted", () => {
    const nurse1 = makeNurse({ id: "n1", contractHours: 36 });
    const nurse2 = makeNurse({ id: "n2", contractHours: 36 });
    const grid = makeGrid([nurse1, nurse2]);

    // Both nurses assigned on SUN
    for (const id of ["n1", "n2"]) {
      const cell = getCell(grid, id, "SUN");
      cell.status = "ASSIGNED";
      cell.primaryClinicId = "clinic-A";
      cell.hours = 7;
    }

    // Secondary slot with demand = 1 (only 1 nurse needed)
    const secondarySlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse1, nurse2], [secondarySlot]);

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

    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;

    const secondarySlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse], [secondarySlot]);

    expect(cell.secondaryClinicId).toBeUndefined();
  });

  it("assigns secondary even when nurse budget is low", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 8 });
    const grid = makeGrid([nurse]);

    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;

    const secondarySlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse], [secondarySlot]);

    // Secondary is within the same shift — budget is irrelevant
    expect(cell.secondaryClinicId).toBe("clinic-B");
    expect(cell.hours).toBe(7); // shift hours unchanged
  });

  it("assigns max 1 secondary per nurse per day", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);

    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;

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

    layer5_secondary(grid, [nurse], [secSlot1, secSlot2]);

    // Should only get first secondary, not both
    expect(cell.secondaryClinicId).toBe("clinic-B");
    expect(cell.hours).toBe(7); // shift hours unchanged
  });

  it("ignores non-secondary clinics", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);

    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "clinic-A";
    cell.hours = 7;

    // canBeSecondary is not set (defaults to undefined/falsy)
    const nonSecondarySlot = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      nursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse], [nonSecondarySlot]);

    expect(cell.secondaryClinicId).toBeUndefined();
  });

  // ── Tests 7-11: Newly-enabled secondary clinics ──

  it("assigns newly-enabled secondary clinic (ophthalmology)", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);

    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "surgery-clinic";
    cell.hours = 7;

    const ophthalmologySlot = makeClinicSlot({
      clinicId: "ophthalmology-clinic",
      clinicCode: "ophthalmology",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse], [ophthalmologySlot]);

    expect(cell.secondaryClinicId).toBe("ophthalmology-clinic");
    expect(cell.hours).toBe(7); // shift hours unchanged
  });

  it("respects secondaryNursesNeeded > 1 (allows multiple nurses)", () => {
    const nurses = [
      makeNurse({ id: "n1", contractHours: 36 }),
      makeNurse({ id: "n2", contractHours: 36 }),
      makeNurse({ id: "n3", contractHours: 36 }),
      makeNurse({ id: "n4", contractHours: 36 }),
    ];
    const grid = makeGrid(nurses);

    // All 4 nurses assigned to different primaries on SUN
    for (const n of nurses) {
      const cell = getCell(grid, n.id, "SUN");
      cell.status = "ASSIGNED";
      cell.primaryClinicId = `primary-${n.id}`;
      cell.hours = 7;
    }

    // Orthopedics with demand = 3
    const orthoSlot = makeClinicSlot({
      clinicId: "ortho-clinic",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 3,
    });

    layer5_secondary(grid, nurses, [orthoSlot]);

    // Exactly 3 of 4 nurses should get orthopedics secondary
    const assigned = nurses.filter(
      (n) => getCell(grid, n.id, "SUN").secondaryClinicId === "ortho-clinic",
    );
    expect(assigned).toHaveLength(3);

    // 4th nurse should NOT get it — demand exhausted
    const unassigned = nurses.filter(
      (n) => !getCell(grid, n.id, "SUN").secondaryClinicId,
    );
    expect(unassigned).toHaveLength(1);
  });

  it("preferred combo is chosen over non-preferred secondary", () => {
    // Mock loadModels to return diabetes→ent combo
    vi.mocked(loadModels).mockReturnValueOnce({
      probabilityMatrix: {},
      shiftPreferences: {},
      offDayPatterns: {},
      dualClinicCombos: [{ primary: "diabetes", secondary: "ent", count: 76 }],
      totalWeeks: 51,
    });

    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);

    const cell = getCell(grid, "n1", "SUN");
    cell.status = "ASSIGNED";
    cell.primaryClinicId = "diabetes-clinic";
    cell.hours = 7;

    // Both available as secondary, but ent is the preferred combo for diabetes
    const vaccinationSlot = makeClinicSlot({
      clinicId: "vaccination-clinic",
      clinicCode: "vaccination",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 1,
      secondaryNursesNeeded: 1,
    });
    const entSlot = makeClinicSlot({
      clinicId: "ent-clinic",
      clinicCode: "ent",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });
    // Include diabetes primary in clinics array so code→id mapping works
    const diabetesPrimarySlot = makeClinicSlot({
      clinicId: "diabetes-clinic",
      clinicCode: "diabetes",
      day: "SUN",
      nursesNeeded: 1,
    });

    layer5_secondary(
      grid,
      [nurse],
      [diabetesPrimarySlot, vaccinationSlot, entSlot],
    );

    // ent should be chosen because it's the preferred combo for diabetes
    expect(cell.secondaryClinicId).toBe("ent-clinic");
    expect(cell.hours).toBe(7); // shift hours unchanged
  });

  it("secondary does not affect cell hours or budget", () => {
    const nurse1 = makeNurse({ id: "n1", contractHours: 36 });
    const nurse2 = makeNurse({ id: "n2", contractHours: 36 });
    const grid = makeGrid([nurse1, nurse2]);

    // Nurse 1 on SUN with a 2h secondary clinic
    const cell1 = getCell(grid, "n1", "SUN");
    cell1.status = "ASSIGNED";
    cell1.primaryClinicId = "primary-A";
    cell1.hours = 7;

    // Nurse 2 on MON with a 1h secondary clinic
    const cell2 = getCell(grid, "n2", "MON");
    cell2.status = "ASSIGNED";
    cell2.primaryClinicId = "primary-B";
    cell2.hours = 7;

    const twoHourSlot = makeClinicSlot({
      clinicId: "surgery-sec",
      day: "SUN",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });
    const oneHourSlot = makeClinicSlot({
      clinicId: "ecg-sec",
      day: "MON",
      canBeSecondary: true,
      secondaryHours: 1,
      secondaryNursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse1, nurse2], [twoHourSlot, oneHourSlot]);

    // Both get assigned but hours stay at shift duration
    expect(cell1.secondaryClinicId).toBe("surgery-sec");
    expect(cell1.hours).toBe(7); // unchanged — 2h secondary is within the shift

    expect(cell2.secondaryClinicId).toBe("ecg-sec");
    expect(cell2.hours).toBe(7); // unchanged — 1h secondary is within the shift
  });

  it("multiple days each get independent secondary assignments", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);

    // Assign nurse to primaries on MON, TUE, WED
    for (const day of ["MON", "TUE", "WED"] as const) {
      const cell = getCell(grid, "n1", day);
      cell.status = "ASSIGNED";
      cell.primaryClinicId = `primary-${day}`;
      cell.hours = 7;
    }

    // Different secondary clinic available each day
    const monSlot = makeClinicSlot({
      clinicId: "sec-mon",
      day: "MON",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });
    const tueSlot = makeClinicSlot({
      clinicId: "sec-tue",
      day: "TUE",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });
    const wedSlot = makeClinicSlot({
      clinicId: "sec-wed",
      day: "WED",
      canBeSecondary: true,
      secondaryHours: 2,
      secondaryNursesNeeded: 1,
    });

    layer5_secondary(grid, [nurse], [monSlot, tueSlot, wedSlot]);

    // Each day should get its own independent secondary
    expect(getCell(grid, "n1", "MON").secondaryClinicId).toBe("sec-mon");
    expect(getCell(grid, "n1", "TUE").secondaryClinicId).toBe("sec-tue");
    expect(getCell(grid, "n1", "WED").secondaryClinicId).toBe("sec-wed");

    // Hours unchanged on all days
    expect(getCell(grid, "n1", "MON").hours).toBe(7);
    expect(getCell(grid, "n1", "TUE").hours).toBe(7);
    expect(getCell(grid, "n1", "WED").hours).toBe(7);
  });
});
