import { test, expect } from "@playwright/test";
import { DEMO_PASSWORD, RECEPTIONIST_EMAIL } from "./fixtures";

test.describe("appointment booking", () => {
  test.skip(
    !RECEPTIONIST_EMAIL,
    "requires E2E_RECEPTIONIST_EMAIL from the seeded demo dataset (set in CI)",
  );

  test("a receptionist can book a new appointment for an existing patient", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(RECEPTIONIST_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/appointments");
    await page.getByRole("button", { name: "Book appointment" }).click();

    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();

    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option").first().click();

    const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);

    await page.getByLabel("Start").fill(toLocalInput(start));
    await page.getByLabel("End").fill(toLocalInput(end));

    await page.getByRole("button", { name: "Book" }).click();

    await expect(page.getByText("Appointment booked")).toBeVisible();
  });
});
