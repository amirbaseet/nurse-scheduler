import { describe, it, expect, beforeEach } from "vitest";
import { layer4_primary } from "@/algorithm/layers/4-primary";
import type { Warning, PreferenceEntry } from "@/algorithm/types";
import {
  makeNurse,
  makeGrid,
  makeBudgets,
  makeClinicSlot,
  getCell,
  resetNurseCounter,
} from "../helpers";

describe("Layer 4 — Primary Clinic Slots", () => {
  let warnings: Warning[];

  beforeEach(() => {
    warnings = [];
    resetNurseCounter();
  });

  it("fills all required slots for a simple day", () => {
    const nurse1 = makeNurse({ id: "n1" });
    const nurse2 = makeNurse({ id: "n2" });
    const nurse3 = makeNurse({ id: "n3" });
    const nurses = [nurse1, nurse2, nurse3];
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);

    const clinicA = makeClinicSlot({
      clinicId: "clinic-A",
      day: "SUN",
      nursesNeeded: 1,
    });
    const clinicB = makeClinicSlot({
      clinicId: "clinic-B",
      day: "SUN",
      nursesNeeded: 1,
    });

    layer4_primary(grid, nurses, [clinicA, clinicB], budgets, [], warnings);

    // Both clinics should have someone assigned
    const assignedSun = nurses.filter(
      (n) => getCell(grid, n.id, "SUN").status === "ASSIGNED",
    );
    expect(assignedSun).toHaveLength(2);

    // Each clinic should have exactly 1 nurse
    const clinicANurse = nurses.find(
      (n) => getCell(grid, n.id, "SUN").primaryClinicId === "clinic-A",
    );
    const clinicBNurse = nurses.find(
      (n) => getCell(grid, n.id, "SUN").primaryClinicId === "clinic-B",
    );
    expect(clinicANurse).toBeDefined();
    expect(clinicBNurse).toBeDefined();
    expect(clinicANurse!.id).not.toBe(clinicBNurse!.id);

    expect(warnings).toHaveLength(0);
  });

  it("uses scoring: morning-preference nurse chosen for morning slot", () => {
    const morningNurse = makeNurse({
      id: "n1",
      shiftPreference: "MORNING",
    });
    const afternoonNurse = makeNurse({
      id: "n2",
      shiftPreference: "AFTERNOON",
    });
    const nurses = [morningNurse, afternoonNurse];
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);

    const morningSlot = makeClinicSlot({
      clinicId: "morning-clinic",
      day: "MON",
      shiftStart: "08:00",
      shiftEnd: "14:00",
      shiftHours: 6,
      nursesNeeded: 1,
    });

    layer4_primary(grid, nurses, [morningSlot], budgets, [], warnings);

    // Morning nurse should be chosen for morning slot due to higher preference score
    expect(getCell(grid, "n1", "MON").status).toBe("ASSIGNED");
    expect(getCell(grid, "n1", "MON").primaryClinicId).toBe("morning-clinic");
  });

  it("respects weekly preferences over nurse defaults", () => {
    // nurse1 default is AFTERNOON, but weekly pref is MORNING
    const nurse1 = makeNurse({
      id: "n1",
      userId: "u1",
      shiftPreference: "AFTERNOON",
    });
    const nurse2 = makeNurse({
      id: "n2",
      userId: "u2",
      shiftPreference: "AFTERNOON",
    });
    const nurses = [nurse1, nurse2];
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);

    const prefs: PreferenceEntry[] = [
      { nurseUserId: "u1", shiftPreference: "MORNING", preferredDaysOff: [] },
    ];

    const morningSlot = makeClinicSlot({
      clinicId: "morning-clinic",
      day: "MON",
      shiftStart: "08:00",
      nursesNeeded: 1,
    });

    layer4_primary(grid, nurses, [morningSlot], budgets, prefs, warnings);

    // nurse1 should be preferred (weekly pref=MORNING matches morning slot)
    expect(getCell(grid, "n1", "MON").status).toBe("ASSIGNED");
  });

  it("emits error warning when no candidates available", () => {
    // All nurses blocked from the clinic
    const nurse = makeNurse({ id: "n1", blockedClinicIds: ["clinic-A"] });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const slot = makeClinicSlot({
      clinicId: "clinic-A",
      day: "SUN",
      nursesNeeded: 1,
    });

    layer4_primary(grid, [nurse], [slot], budgets, [], warnings);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].level).toBe("error");
    expect(warnings[0].clinicId).toBe("clinic-A");
  });

  it("deducts hours from budget after each assignment", () => {
    const nurse = makeNurse({ id: "n1", contractHours: 36 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const slot1 = makeClinicSlot({
      clinicId: "clinic-A",
      day: "MON",
      shiftHours: 7,
      nursesNeeded: 1,
    });
    const slot2 = makeClinicSlot({
      clinicId: "clinic-B",
      day: "TUE",
      shiftHours: 6,
      nursesNeeded: 1,
    });

    layer4_primary(grid, [nurse], [slot1, slot2], budgets, [], warnings);

    expect(budgets.get("n1")).toBe(36 - 7 - 6);
  });

  it("skips gender-restricted slots (genderPref != ANY)", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const femaleOnlySlot = makeClinicSlot({
      clinicId: "womens-health",
      day: "MON",
      genderPref: "FEMALE_ONLY",
      nursesNeeded: 1,
    });

    layer4_primary(grid, [nurse], [femaleOnlySlot], budgets, [], warnings);

    // Should not be processed by Layer 4
    expect(getCell(grid, "n1", "MON").status).toBe("AVAILABLE");
    expect(warnings).toHaveLength(0);
  });

  it("fills multi-nurse slot with different nurses", () => {
    const nurse1 = makeNurse({ id: "n1" });
    const nurse2 = makeNurse({ id: "n2" });
    const nurses = [nurse1, nurse2];
    const grid = makeGrid(nurses);
    const budgets = makeBudgets(nurses);

    const slot = makeClinicSlot({
      clinicId: "busy-clinic",
      day: "SUN",
      nursesNeeded: 2,
    });

    layer4_primary(grid, nurses, [slot], budgets, [], warnings);

    // Both nurses should be assigned to the same clinic
    expect(getCell(grid, "n1", "SUN").status).toBe("ASSIGNED");
    expect(getCell(grid, "n1", "SUN").primaryClinicId).toBe("busy-clinic");
    expect(getCell(grid, "n2", "SUN").status).toBe("ASSIGNED");
    expect(getCell(grid, "n2", "SUN").primaryClinicId).toBe("busy-clinic");
  });
});
