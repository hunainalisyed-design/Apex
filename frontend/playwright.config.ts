import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Locally, one browser at a time: the suite drives the real 3D showroom on the machine's GPU,
  // and parallel browsers sharing one (integrated) GPU can lose their WebGL context or starve
  // each other. CI keeps Playwright's default parallelism (it renders in software there).
  workers: process.env.CI ? undefined : 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // Render WebGL on the real GPU where there is one (Direct3D on Windows). Otherwise headless
    // Chromium draws the 3D showroom in software, which keeps the page so busy that a single click
    // can take seconds. On machines without a GPU (e.g. CI) these fall back to software rendering.
    launchOptions: { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
