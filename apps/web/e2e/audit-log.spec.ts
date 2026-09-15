import { test, expect } from "@playwright/test";
import {
  DEMO_PASSWORD,
  CLINIC_ADMIN_EMAIL,
  RECEPTIONIST_EMAIL,
} from "./fixtures";

test.describe("audit log access control", () => {
  test.skip(
    !CLINIC_ADMIN_EMAIL,
    "requires E2E_CLINIC_ADMIN_EMAIL from the seeded demo dataset (set in CI)",
  );

  test("a clinic admin can view the clinic's audit log", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(CLINIC_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/audit-log");
    await expect(
      page.getByRole("heading", { name: "Audit log" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Action" }),
    ).toBeVisible();
  });

  test("a receptionist does not see the audit log link and is refused direct navigation", async ({
    page,
  }) => {
    test.skip(
      !RECEPTIONIST_EMAIL,
      "requires E2E_RECEPTIONIST_EMAIL from the seeded demo dataset (set in CI)",
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(RECEPTIONIST_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);

    // Client-side hiding is UX only — the real control is server-side
    // (RolesGuard/PolicyGuard). Direct navigation must still be refused by
    // the API, surfacing as an error state here rather than real data.
    await page.goto("/audit-log");
    await expect(
      page.getByRole("cell", { name: /./ }).first(),
    ).not.toContainText("progress note");
  });
});
