/**
 * Path B: Create Request → Approve → Reflected in Schedule Generation
 *
 * Integration test that exercises the time-off request flow
 * and verifies the algorithm respects approved requests.
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
let requestId: string;

// Future week dates (must be in the future for the request validator)
const WEEK = "2026-03-15"; // Sunday
const OFF_START = "2026-03-15"; // SUN
const OFF_END = "2026-03-16"; // MON

describe("Path B: Create Request → Approve → Reflected in Generation", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    seed = await seedTestData(db);
  }, 30_000);

  afterAll(async () => {
    await teardownTestDb();
  });

  // ────────────────────────────────────────────
  // Step 1: Nurse creates a time-off request
  // ────────────────────────────────────────────
  it("nurse creates a time-off request", async () => {
    mockAuthAs(seed.nurse1Token);

    const { POST } = await import("@/app/api/requests/route");

    const request = buildRequest("http://localhost:3000/api/requests", {
      method: "POST",
      body: {
        type: "VACATION",
        startDate: OFF_START,
        endDate: OFF_END,
        reason: "חופשה משפחתית",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.status).toBe("PENDING");
    expect(data.type).toBe("VACATION");
    expect(data.nurseId).toBe(seed.nurse1Id);

    requestId = data.id;

    // Verify manager was notified
    const managerNotifs = await db.notification.findMany({
      where: { userId: seed.managerId, type: "new_request" },
    });
    expect(managerNotifs.length).toBeGreaterThanOrEqual(1);
  });

  // ────────────────────────────────────────────
  // Step 2: Manager approves the request
  // ────────────────────────────────────────────
  it("manager approves the request", async () => {
    mockAuthAs(seed.managerToken);

    const { PUT } = await import("@/app/api/requests/[id]/approve/route");

    const request = buildRequest(
      `http://localhost:3000/api/requests/${requestId}/approve`,
      {
        method: "PUT",
        body: { managerNote: "מאושר" },
      },
    );

    const response = await PUT(request, { params: { id: requestId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("APPROVED");

    // Verify DB reflects approval
    const dbRequest = await db.timeOffRequest.findUnique({
      where: { id: requestId },
    });
    expect(dbRequest?.status).toBe("APPROVED");
    expect(dbRequest?.respondedAt).not.toBeNull();

    // Verify nurse was notified of approval
    const nurseNotifs = await db.notification.findMany({
      where: { userId: seed.nurse1Id, type: "request_approved" },
    });
    expect(nurseNotifs.length).toBeGreaterThanOrEqual(1);
  });

  // ────────────────────────────────────────────
  // Step 3: Approved time-off reflected in generation
  // ────────────────────────────────────────────
  it("approved time-off is reflected in schedule generation", async () => {
    mockAuthAs(seed.managerToken);

    const { POST } = await import("@/app/api/schedule/generate/route");

    const request = buildRequest("http://localhost:3000/api/schedule/generate", {
      method: "POST",
      body: { weekStart: WEEK },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.schedule).toBeDefined();

    // Nurse1 should NOT be assigned primary clinics on SUN and MON
    // (the days covered by the approved time-off request)
    const scheduleId = data.schedule.id;
    const nurse1Assignments = await db.scheduleAssignment.findMany({
      where: {
        scheduleId,
        nurseId: seed.nurse1ProfileId,
        day: { in: ["SUN", "MON"] },
      },
    });

    for (const assignment of nurse1Assignments) {
      // Either no primary clinic assigned, or marked as off
      expect(
        assignment.primaryClinicId === null || assignment.isOff === true,
      ).toBe(true);
    }
  }, 15_000);
});
