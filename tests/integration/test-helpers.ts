/**
 * Integration test helpers — DB setup, auth mocking, seed data, request builder.
 *
 * Uses a separate test.db via DATABASE_URL override.
 * Mocks next/headers cookies() to inject controlled JWT tokens.
 */
import { vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "child_process";
import path from "path";
import fs from "fs";

// ═══════════════════════════════════════════
// DB Isolation — prisma/test.db
// ═══════════════════════════════════════════

const TEST_DB_PATH = path.resolve(__dirname, "../../prisma/test.db");
// Prisma resolves file: URLs relative to schema.prisma location (prisma/)
// Use relative for CLI commands, absolute for PrismaClient constructor
const PRISMA_CLI_DB_URL = "file:./test.db";
const PRISMA_CLIENT_DB_URL = `file:${TEST_DB_PATH}`;

let testDb: PrismaClient | null = null;

export async function setupTestDb(): Promise<PrismaClient> {
  // Set env BEFORE importing anything that reads it
  process.env.DATABASE_URL = PRISMA_CLI_DB_URL;
  process.env.JWT_SECRET =
    "test-secret-for-integration-tests-64chars-minimum-xxxxxxxxxxxxxxxxxxxx";

  // Clean up any leftover test.db to avoid lock issues
  for (const file of [TEST_DB_PATH, `${TEST_DB_PATH}-journal`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  // Push schema to test.db (creates tables fresh)
  // User consented to --force-reset on test.db for integration tests
  execFileSync(
    "npx",
    ["prisma", "db", "push", "--force-reset", "--skip-generate"],
    {
      cwd: path.resolve(__dirname, "../.."),
      env: {
        ...process.env,
        DATABASE_URL: PRISMA_CLI_DB_URL,
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "Yes, allow it",
      },
      stdio: "pipe",
    },
  );

  testDb = new PrismaClient({
    datasources: { db: { url: PRISMA_CLIENT_DB_URL } },
    log: ["error"],
  });

  await testDb.$connect();
  return testDb;
}

export function getTestDb(): PrismaClient {
  if (!testDb) throw new Error("Call setupTestDb() first");
  return testDb;
}

export async function teardownTestDb(): Promise<void> {
  if (testDb) {
    await testDb.$disconnect();
    testDb = null;
  }
  // Clean up test.db files
  for (const file of [TEST_DB_PATH, `${TEST_DB_PATH}-journal`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

// ═══════════════════════════════════════════
// Auth Mocking — inject controlled JWT
// ═══════════════════════════════════════════

let currentToken: string | null = null;

// Must be called BEFORE importing route handlers
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      name === "token" && currentToken ? { value: currentToken } : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock NextResponse to work outside Next.js runtime
vi.mock("next/server", async () => {
  const actual =
    await vi.importActual<typeof import("next/server")>("next/server");
  return actual;
});

export function mockAuthAs(token: string): void {
  currentToken = token;
}

export function clearAuth(): void {
  currentToken = null;
}

export async function createToken(
  userId: string,
  role: "MANAGER" | "NURSE",
  name: string,
): Promise<string> {
  const { signJwt } = await import("@/lib/auth");
  return signJwt({ userId, role, name });
}

// ═══════════════════════════════════════════
// Mock @/lib/db to use test database
// ═══════════════════════════════════════════

vi.mock("@/lib/db", () => ({
  get db() {
    if (!testDb)
      throw new Error("Test DB not initialized — call setupTestDb()");
    return testDb;
  },
}));

// ═══════════════════════════════════════════
// Seed Minimal Test Data
// ═══════════════════════════════════════════

export type SeedResult = {
  managerId: string;
  managerToken: string;
  nurse1Id: string;
  nurse1ProfileId: string;
  nurse1Token: string;
  nurse2Id: string;
  nurse2ProfileId: string;
  nurse2Token: string;
  clinicIds: string[];
};

export async function seedTestData(db: PrismaClient): Promise<SeedResult> {
  const { hashPin } = await import("@/lib/pin");

  // ── Manager ──
  const manager = await db.user.create({
    data: {
      name: "ראשת צוות",
      role: "MANAGER",
      pinHash: await hashPin("284756"),
      pinPrefix: "28",
      isActive: true,
    },
  });

  // ── Nurse 1 — morning preference ──
  const nurse1 = await db.user.create({
    data: {
      name: "נסרין עלי",
      role: "NURSE",
      pinHash: await hashPin("1234"),
      pinPrefix: "12",
      isActive: true,
      nurseProfile: {
        create: {
          gender: "FEMALE",
          contractHours: 36,
          shiftPreference: "MORNING",
          canWorkFriday: false,
          canWorkSaturday: false,
          maxDaysPerWeek: 5,
          employmentType: "FULL_TIME",
          recurringOffDays: [],
        },
      },
    },
    include: { nurseProfile: true },
  });

  // ── Nurse 2 — afternoon preference ──
  const nurse2 = await db.user.create({
    data: {
      name: "נסרין משני",
      role: "NURSE",
      pinHash: await hashPin("5678"),
      pinPrefix: "56",
      isActive: true,
      nurseProfile: {
        create: {
          gender: "FEMALE",
          contractHours: 36,
          shiftPreference: "AFTERNOON",
          canWorkFriday: false,
          canWorkSaturday: false,
          maxDaysPerWeek: 5,
          employmentType: "FULL_TIME",
          recurringOffDays: [],
        },
      },
    },
    include: { nurseProfile: true },
  });

  // ── 3 Clinics with default configs for SUN-THU ──
  const days = ["SUN", "MON", "TUE", "WED", "THU"] as const;
  const clinicData = [
    { name: "עיניים", code: "EYES" },
    { name: "אף אוזן גרון", code: "ENT" },
    { name: "כירורגיה", code: "SURG" },
  ];

  const clinicIds: string[] = [];

  for (const cd of clinicData) {
    const clinic = await db.clinic.create({
      data: {
        name: cd.name,
        code: cd.code,
        genderPref: "ANY",
        canBeSecondary: false,
        isActive: true,
      },
    });
    clinicIds.push(clinic.id);

    // Create default configs for each weekday
    for (const day of days) {
      await db.clinicDefaultConfig.create({
        data: {
          clinicId: clinic.id,
          day,
          shiftStart: "08:00",
          shiftEnd: "15:00",
          nursesNeeded: 1,
          isActive: true,
        },
      });
    }
  }

  // ── Create JWT tokens ──
  const managerToken = await createToken(manager.id, "MANAGER", manager.name);
  const nurse1Token = await createToken(nurse1.id, "NURSE", nurse1.name);
  const nurse2Token = await createToken(nurse2.id, "NURSE", nurse2.name);

  return {
    managerId: manager.id,
    managerToken,
    nurse1Id: nurse1.id,
    nurse1ProfileId: (
      nurse1 as typeof nurse1 & { nurseProfile: { id: string } }
    ).nurseProfile.id,
    nurse1Token,
    nurse2Id: nurse2.id,
    nurse2ProfileId: (
      nurse2 as typeof nurse2 & { nurseProfile: { id: string } }
    ).nurseProfile.id,
    nurse2Token,
    clinicIds,
  };
}

// ═══════════════════════════════════════════
// Request Builder
// ═══════════════════════════════════════════

export function buildRequest(
  url: string,
  opts?: { method?: string; body?: unknown },
): Request {
  return new Request(url, {
    method: opts?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
}
