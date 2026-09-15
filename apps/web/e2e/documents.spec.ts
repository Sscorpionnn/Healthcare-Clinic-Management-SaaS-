import path from "node:path";
import { test, expect } from "@playwright/test";
import { DEMO_PASSWORD, DOCTOR_EMAIL } from "./fixtures";

test.describe("document upload", () => {
  test.skip(
    !DOCTOR_EMAIL,
    "requires E2E_DOCTOR_EMAIL from the seeded demo dataset (set in CI)",
  );

  test("a doctor can upload a document for a patient through the two-phase flow", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(DOCTOR_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/documents");
    await page.getByRole("button", { name: "Upload document" }).click();

    await page.getByText("Select a patient").click();
    await page.getByRole("option").first().click();

    await page.setInputFiles(
      'input[type="file"]',
      path.join(__dirname, "fixtures", "sample.pdf"),
    );

    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByText("Document uploaded")).toBeVisible();
  });

  test("rejects a disallowed file type client-side before any upload starts", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(DOCTOR_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/documents");
    await page.getByRole("button", { name: "Upload document" }).click();
    await page.setInputFiles(
      'input[type="file"]',
      path.join(__dirname, "fixtures", "not-allowed.txt"),
    );

    await expect(page.getByText("File type not allowed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload" })).toBeDisabled();
  });
});
