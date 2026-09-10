import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 120_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:41730",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Dedicated port and no server reuse: with reuse enabled, any unrelated
    // process listening on the port (Vite's preview default 4173 is a common
    // one) is silently tested instead of the stubbed dev server.
    command: "npm run dev -- --port 41730 --strictPort",
    url: "http://localhost:41730",
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? "test-anon-key",
      VOTEX_E2E_MODE: "true",
    },
  },
});
