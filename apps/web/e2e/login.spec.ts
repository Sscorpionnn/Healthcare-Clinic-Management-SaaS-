import { test, expect } from "@playwright/test";
import { DEMO_PASSWORD, SUPER_ADMIN_EMAIL } from "./fixtures";

test.describe("login", () => {
  test("signs in with valid credentials and reaches the dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(SUPER_ADMIN_EMAIL)).toBeVisible();
  });

  test("shows a generic error for invalid credentials without revealing whether the account exists", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-a-real-account@example.test");
    await page.getByLabel("Password").fill("wrong-password-entirely");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Sign-in failed")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated visitors are redirected away from the dashboard", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
