/**
 * Mobile smoke tests for nurse-facing screens at 375px (iPhone SE).
 *
 * Prereq: dev server running at localhost:3000 with seeded DB.
 * These tests verify basic rendering and no horizontal overflow.
 */
import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";
import { readFileSync } from "fs";
import { resolve } from "path";
import { execFileSync } from "child_process";

const PROJECT_ROOT = resolve(__dirname, "../..");

// Read JWT_SECRET from the project .env file (same source as the dev server)
function readJwtSecret(): string {
  const envContent = readFileSync(resolve(PROJECT_ROOT, ".env"), "utf-8");
  const match = envContent.match(/^JWT_SECRET="?([^"\n]+)"?/m);
  if (!match) throw new Error("JWT_SECRET not found in .env");
  return match[1];
}

// Query the dev SQLite DB for the first active nurse (uses execFileSync — no shell)
function findNurseInDb(): { id: string; name: string } {
  const dbPath = resolve(PROJECT_ROOT, "prisma/dev.db");
  const row = execFileSync(
    "sqlite3",
    [
      dbPath,
      "SELECT id, name FROM User WHERE role = 'NURSE' AND isActive = 1 LIMIT 1;",
    ],
    { encoding: "utf-8" },
  ).trim();
  const [id, name] = row.split("|");
  if (!id || !name)
    throw new Error("No active nurse found in dev.db — run prisma db seed");
  return { id, name };
}

// Create a JWT and inject it as an httpOnly cookie, bypassing the login UI.
async function loginAsNurse(page: import("@playwright/test").Page) {
  const secret = new TextEncoder().encode(readJwtSecret());
  const nurse = findNurseInDb();

  const token = await new SignJWT({
    userId: nurse.id,
    role: "NURSE",
    name: nurse.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  await page.context().addCookies([
    {
      name: "token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
}

// Helper: assert no horizontal overflow at 375px
async function assertNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
  const overflow = await page.evaluate(() => {
    return (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
    );
  });
  expect(overflow).toBe(false);
}

test.describe("Nurse mobile screens at 375px", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsNurse(page);
  });

  test("dashboard loads without horizontal overflow", async ({ page }) => {
    await page.goto("/nurse");
    await page.waitForLoadState("networkidle");

    // Bottom nav should be visible with 5 items
    const bottomNav = page.locator("nav.fixed.bottom-0");
    await expect(bottomNav).toBeVisible();

    const navLinks = bottomNav.locator("a");
    await expect(navLinks).toHaveCount(5);

    // No horizontal overflow
    await assertNoHorizontalOverflow(page);

    // Capture screenshot
    await page.screenshot({ path: "test-results/dashboard-375.png" });
  });

  test("announcements page renders correctly", async ({ page }) => {
    await page.goto("/nurse/announcements");
    await page.waitForLoadState("networkidle");

    // Page heading should be visible
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();

    // No horizontal overflow
    await assertNoHorizontalOverflow(page);

    // Capture screenshot
    await page.screenshot({ path: "test-results/announcements-375.png" });
  });

  test("tasks page renders correctly", async ({ page }) => {
    await page.goto("/nurse/tasks");
    await page.waitForLoadState("networkidle");

    // Page heading should be visible
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();

    // Bottom nav should not overlap content (content should have padding-bottom)
    const main = page.locator("main");
    const mainPadding = await main.evaluate((el) => {
      return parseInt(getComputedStyle(el).paddingBottom, 10);
    });
    expect(mainPadding).toBeGreaterThanOrEqual(56); // min bottom nav height

    // No horizontal overflow
    await assertNoHorizontalOverflow(page);

    // Capture screenshot
    await page.screenshot({ path: "test-results/tasks-375.png" });
  });
});
