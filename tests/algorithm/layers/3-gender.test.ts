import { describe, it, expect, beforeEach } from "vitest";
import { layer3_gender } from "@/algorithm/layers/3-gender";
import type { Warning } from "@/algorithm/types";
import {
  makeNurse,
  makeGrid,
  makeBudgets,
  makeClinicSlot,
  getCell,
  resetNurseCounter,
} from "../helpers";

describe("Layer 3 — Gender-Restricted Clinics", () => {
  let warnings: Warning[];

  beforeEach(() => {
    warnings = [];
    resetNurseCounter();
  });

  it("FEMALE_ONLY clinic gets a female nurse assigned", () => {
    const femaleNurse = makeNurse({ id: "n1", gender: "FEMALE" });
    const maleNurse = makeNurse({ id: "n2", gender: "MALE" });
    const grid = makeGrid([femaleNurse, maleNurse]);
    const budgets = makeBudgets([femaleNurse, maleNurse]);

    const slot = makeClinicSlot({
      clinicId: "womens-health",
      day: "MON",
      genderPref: "FEMALE_ONLY",
      nursesNeeded: 1,
    });

    layer3_gender(grid, [femaleNurse, maleNurse], [slot], budgets, warnings);

    expect(getCell(grid, "n1", "MON").status).toBe("ASSIGNED");
    expect(getCell(grid, "n1", "MON").primaryClinicId).toBe("womens-health");
    // Male nurse should NOT be assigned
    expect(getCell(grid, "n2", "MON").status).toBe("AVAILABLE");
    expect(warnings).toHaveLength(0);
  });

  it("emits error when no female nurse available for FEMALE_ONLY", () => {
    const maleNurse = makeNurse({ id: "n1", gender: "MALE" });
    const grid = makeGrid([maleNurse]);
    const budgets = makeBudgets([maleNurse]);

    const slot = makeClinicSlot({
      clinicId: "womens-health",
      day: "MON",
      genderPref: "FEMALE_ONLY",
      nursesNeeded: 1,
    });

    layer3_gender(grid, [maleNurse], [slot], budgets, warnings);

    expect(getCell(grid, "n1", "MON").status).toBe("AVAILABLE"); // not assigned
    expect(warnings).toHaveLength(1);
    expect(warnings[0].level).toBe("error");
    expect(warnings[0].clinicId).toBe("womens-health");
  });

  it("FEMALE_PREFERRED falls back to male when no female available", () => {
    const maleNurse = makeNurse({ id: "n1", gender: "MALE" });
    const grid = makeGrid([maleNurse]);
    const budgets = makeBudgets([maleNurse]);

    const slot = makeClinicSlot({
      clinicId: "prenatal",
      day: "TUE",
      genderPref: "FEMALE_PREFERRED",
      nursesNeeded: 1,
    });

    layer3_gender(grid, [maleNurse], [slot], budgets, warnings);

    // Male nurse assigned as fallback
    expect(getCell(grid, "n1", "TUE").status).toBe("ASSIGNED");
    expect(getCell(grid, "n1", "TUE").primaryClinicId).toBe("prenatal");
    // Should have a warning about using non-female
    expect(warnings.some((w) => w.level === "warning")).toBe(true);
  });

  it("FEMALE_PREFERRED prefers female when available", () => {
    const femaleNurse = makeNurse({ id: "n1", gender: "FEMALE" });
    const maleNurse = makeNurse({ id: "n2", gender: "MALE" });
    const grid = makeGrid([femaleNurse, maleNurse]);
    const budgets = makeBudgets([femaleNurse, maleNurse]);

    const slot = makeClinicSlot({
      clinicId: "prenatal",
      day: "TUE",
      genderPref: "FEMALE_PREFERRED",
      nursesNeeded: 1,
    });

    layer3_gender(
      grid,
      [femaleNurse, maleNurse],
      [slot],
      budgets,
      warnings,
    );

    // Female should be picked
    expect(getCell(grid, "n1", "TUE").status).toBe("ASSIGNED");
    expect(getCell(grid, "n2", "TUE").status).toBe("AVAILABLE");
    expect(warnings).toHaveLength(0);
  });

  it("FEMALE_ONLY processed before FEMALE_PREFERRED", () => {
    // Only 1 female nurse, 2 gender-restricted slots
    const femaleNurse = makeNurse({ id: "n1", gender: "FEMALE" });
    const maleNurse = makeNurse({ id: "n2", gender: "MALE" });
    const grid = makeGrid([femaleNurse, maleNurse]);
    const budgets = makeBudgets([femaleNurse, maleNurse]);

    const onlySlot = makeClinicSlot({
      clinicId: "womens-health",
      day: "MON",
      genderPref: "FEMALE_ONLY",
      nursesNeeded: 1,
    });
    const preferredSlot = makeClinicSlot({
      clinicId: "prenatal",
      day: "MON",
      genderPref: "FEMALE_PREFERRED",
      nursesNeeded: 1,
    });

    // Pass in reverse order — preferred first — to test sorting
    layer3_gender(
      grid,
      [femaleNurse, maleNurse],
      [preferredSlot, onlySlot],
      budgets,
      warnings,
    );

    // Female should go to FEMALE_ONLY (processed first)
    expect(getCell(grid, "n1", "MON").primaryClinicId).toBe("womens-health");
    // Male falls back to FEMALE_PREFERRED
    expect(getCell(grid, "n2", "MON").primaryClinicId).toBe("prenatal");
  });

  it("deducts hours from budget after assignment", () => {
    const nurse = makeNurse({ id: "n1", gender: "FEMALE", contractHours: 36 });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const slot = makeClinicSlot({
      clinicId: "womens-health",
      day: "MON",
      genderPref: "FEMALE_ONLY",
      shiftHours: 7,
      nursesNeeded: 1,
    });

    layer3_gender(grid, [nurse], [slot], budgets, warnings);

    expect(budgets.get("n1")).toBe(36 - 7);
  });

  it("skips ANY gender clinics (leaves them for Layer 4)", () => {
    const nurse = makeNurse({ id: "n1" });
    const grid = makeGrid([nurse]);
    const budgets = makeBudgets([nurse]);

    const anySlot = makeClinicSlot({
      clinicId: "general",
      day: "MON",
      genderPref: "ANY",
      nursesNeeded: 1,
    });

    layer3_gender(grid, [nurse], [anySlot], budgets, warnings);

    // Should remain AVAILABLE — Layer 3 doesn't process ANY slots
    expect(getCell(grid, "n1", "MON").status).toBe("AVAILABLE");
  });
});
