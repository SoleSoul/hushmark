import { defineConfig, devices } from "@playwright/test";

const port = 1430;

// Browser tests run the real frontend against a fake Tauri backend
// (e2e/harness.html). Edge and Chromium stand in for Windows WebView2, and
// WebKit for macOS WKWebView and Linux WebKitGTK. `npm run test:e2e` runs
// Chromium locally; CI runs each engine on its own operating system.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 900, height: 700 },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 900, height: 700 } } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 900, height: 700 } } },
    // Microsoft Edge shares WebView2's engine; available on Windows CI runners.
    { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 900, height: 700 } } },
  ],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/e2e/harness.html`,
    reuseExistingServer: !process.env.CI,
  },
});
