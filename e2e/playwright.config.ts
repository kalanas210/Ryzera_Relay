import { defineConfig, devices } from "@playwright/test";

/** The browser walkthrough. Every test starts its own private copy of the story day, so tests run in parallel and
 *  never touch the shared walkthrough (MAIN).
 *
 *  Locally it runs against the two dev servers (Vite on 5173, the API on 8765). A name under .localhost keeps this
 *  suite's cookies apart from any other browser on the machine. CI runs it against `docker compose up` with
 *  E2E_BASE_URL=http://localhost:8080. */
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  // every copy runs its own solver and story autopilot on one API process: a few at a time keeps jumps quick
  workers: ci ? 2 : 3,
  // a test that jumps the clock waits on the story autopilot, and a plan proposal on a cold engine cache runs the
  // solver for 20 to 30 s, so each test gets minutes, not seconds; the walkthrough sets its own
  timeout: 3 * 60_000,
  // In CI the whole run, retries included, ends well inside the job's 15 minutes, so a hung API fails the run with
  // its report and traces instead of the job being cancelled without them. A full run takes about 3 minutes there.
  globalTimeout: ci ? 8 * 60_000 : undefined,
  expect: { timeout: 20_000 },
  reporter: ci
    ? [["list"], ["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://e2e.localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    // the driver's phone saves a location reading with each arrival, delivery and report when it is allowed one:
    // Kegalle, where Kasun's first stop is
    permissions: ["geolocation"],
    geolocation: { latitude: 7.2513, longitude: 80.3464 },
  },
  projects: [
    {
      // the dispatcher's desk, and the walkthrough, which opens a phone-size tab beside it for the field roles
      name: "desk",
      grep: /@desk/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      // the store manager, the loader and the driver on a phone
      name: "phone",
      grep: /@phone/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
