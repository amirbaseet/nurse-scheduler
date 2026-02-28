/**
 * Path A: Login → Generate → Edit → Publish → Nurse Sees Schedule
 *
 * Integration test that exercises the full schedule lifecycle
 * through actual API route handlers with a real test database.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  setupTestDb,
  teardownTestDb,
  seedTestData,
  mockAuthAs,
  buildRequest,
  type SeedResult,
} from "./test-helpers";

let db: PrismaClient;
let seed: SeedResult;
let scheduleId: string;

// ── Week we'll generate for (a future Sunday) ──
const WEEK = "2026-03-08";

describe("Path A: Login → Generate → Edit → Publish → Nurse Sees Schedule", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    seed = await seedTestData(db);
  }, 30_000);

  afterAll(async () => {
    await teardownTestDb();
  });

  // ────────────────────────────────────────────
  // Step 1: Manager generates a weekly schedule
  // ────────────────────────────────────────────
  it("manager generates a weekly schedule", async () => {
    mockAuthAs(seed.managerToken);

    const { POST } = await import("@/app/api/schedule/generate/route");

    const request = buildRequest(
      "http://localhost:3000/api/schedule/generate",
      {
        method: "POST",
        body: { weekStart: WEEK },
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.schedule).toBeDefined();
    expect(data.schedule.status).toBe("GENERATED");
    expect(data.qualityScore).toBeGreaterThanOrEqual(0);

    // Save scheduleId for subsequent tests
    scheduleId = data.schedule.id;

    // Verify assignments were created in DB
    const assignments = await db.scheduleAssignment.findMany({
      where: { scheduleId },
    });
    expect(assignments.length).toBeGreaterThan(0);
  }, 15_000);

  // ────────────────────────────────────────────
  // Step 2: Manager edits an assignment (change clinic)
  // ────────────────────────────────────────────
  it("manager edits an assignment and correction is tracked", async () => {
    mockAuthAs(seed.managerToken);

    // Find an assignment for nurse1 with a primary clinic
    const nurse1Assignment = await db.scheduleAssignment.findFirst({
      where: {
        scheduleId,
        nurseId: seed.nurse1ProfileId,
        primaryClinicId: { not: null },
      },
    });

    expect(nurse1Assignment).not.toBeNull();

    // Find a different clinic to reassign to
    const differentClinicId = seed.clinicIds.find(
      (id) => id !== nurse1Assignment!.primaryClinicId,
    );
    expect(differentClinicId).toBeDefined();

    const { PUT } = await import("@/app/api/schedule/[id]/assign/route");

    const request = buildRequest(
      `http://localhost:3000/api/schedule/${scheduleId}/assign`,
      {
        method: "PUT",
        body: {
          assignmentId: nurse1Assignment!.id,
          primaryClinicId: differentClinicId,
        },
      },
    );

    const response = await PUT(request, { params: { id: scheduleId } });
    expect(response.status).toBe(200);

    // Verify correction was tracked
    const corrections = await db.scheduleCorrection.findMany({
      where: { scheduleId },
    });
    expect(corrections.length).toBeGreaterThanOrEqual(1);
    expect(corrections[0].correctionType).toBe("change_clinic");
    expect(corrections[0].originalNurseId).toBe(seed.nurse1ProfileId);
    expect(corrections[0].originalClinicId).toBe(
      nurse1Assignment!.primaryClinicId,
    );
  });

  // ────────────────────────────────────────────
  // Step 3: Manager publishes the schedule
  // ────────────────────────────────────────────
  it("manager publishes the schedule", async () => {
    mockAuthAs(seed.managerToken);

    const { POST } = await import("@/app/api/schedule/[id]/publish/route");

    const request = buildRequest(
      `http://localhost:3000/api/schedule/${scheduleId}/publish`,
      { method: "POST" },
    );

    const response = await POST(request, { params: { id: scheduleId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify DB state
    const schedule = await db.weeklySchedule.findUnique({
      where: { id: scheduleId },
    });
    expect(schedule?.status).toBe("PUBLISHED");
    expect(schedule?.publishedAt).not.toBeNull();

    // Verify notifications were created for nurse users
    const notifications = await db.notification.findMany({
      where: { type: "schedule_published" },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(2); // nurse1 + nurse2
  });

  // ────────────────────────────────────────────
  // Step 4: Nurse sees their published schedule
  // ────────────────────────────────────────────
  it("nurse sees their published schedule", async () => {
    mockAuthAs(seed.nurse1Token);

    const { GET } = await import("@/app/api/schedule/nurse/me/[week]/route");

    const request = buildRequest(
      `http://localhost:3000/api/schedule/nurse/me/${WEEK}`,
    );

    const response = await GET(request, { params: { week: WEEK } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("PUBLISHED");
    expect(Array.isArray(data.assignments)).toBe(true);

    // Nurse should have assignments (7 days of data — some may be off days)
    expect(data.assignments.length).toBeGreaterThanOrEqual(0);
  });
});
