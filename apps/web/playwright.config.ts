import { defineConfig, devices } from "@playwright/test";
import { studentApiPort, studentApiUrl } from "./tests/support/student-api";

const webPort = 3101;

export default defineConfig({
  testDir: "./tests",
  // Every test shares one stand-in API whose scenario and request log are
  // global, so tests must not run concurrently.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/support/student-api-server.mts",
      url: `${studentApiUrl}/__health`,
      reuseExistingServer: !process.env.CI,
      env: { STUDENT_API_PORT: String(studentApiPort) },
    },
    {
      command: `pnpm start --hostname 127.0.0.1 --port ${webPort}`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: !process.env.CI,
      env: { ATTAINLINE_API_URL: studentApiUrl },
    },
  ],
});
