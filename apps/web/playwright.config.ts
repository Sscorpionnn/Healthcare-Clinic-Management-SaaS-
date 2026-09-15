import { defineConfig, devices } from "@playwright/test";

// Runs against the full docker-compose stack (Postgres, Redis, MinIO, API,
// web) — see docker-compose.yml at the repo root and docs/test-strategy.md.
// Not started automatically here: CI brings the stack up before invoking
// `pnpm test:e2e`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
