import { expect, test, type Page } from "@playwright/test";

// Spec 30 — shareable video clip. Records a real clip with the browser's own MediaRecorder
// (Chromium supports canvas capture), then checks the downloaded file. The fallback test
// removes MediaRecorder before the page loads, like a browser without it.
async function openShowroom(page: Page) {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("main[data-scene-ready='true']")).toBeVisible({ timeout: 60000 });
}

test.describe("Shareable video clip (Spec 30)", () => {
  // Frame-by-frame rendering of 120 frames at 720×1280 takes a few seconds on a real GPU but
  // several minutes under this headless browser's software WebGL, hence the long budget.
  test.setTimeout(900000);

  test("records a vertical orbit clip and saves it with the build's name (AC-1, AC-3, AC-4)", async ({ page }) => {
    await openShowroom(page);
    await page.getByRole("button", { name: "Capture Video" }).click();

    // AC-3: a visible progress indicator while recording, covering the scene.
    await expect(page.getByTestId("video-recording-overlay")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("progressbar")).toBeVisible();

    const dialog = page.getByRole("dialog", { name: "Your Build Video" });
    await expect(dialog).toBeVisible({ timeout: 800000 });
    await expect(page.getByTestId("video-recording-overlay")).toHaveCount(0);

    // The preview is a real, decodable video in portrait 9:16.
    const video = page.getByTestId("captured-video");
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 20000 }).toBeGreaterThanOrEqual(1);
    const { width, height, duration } = await video.evaluate((v: HTMLVideoElement) => ({ width: v.videoWidth, height: v.videoHeight, duration: v.duration }));
    expect(width / height).toBeCloseTo(9 / 16, 2);
    // The whole 4-second orbit, even though this headless browser renders only ~2 fps — the
    // frame-by-frame encoder doesn't depend on how fast the device renders.
    expect(duration).toBeGreaterThan(3.9);
    expect(duration).toBeLessThan(4.1);

    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Save Video" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^apex-gt-[A-Z]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\.(mp4|webm)$/);
    const path = await download.path();
    const { statSync } = await import("node:fs");
    expect(statSync(path!).size).toBeGreaterThan(10_000);
  });

  test("falls back to an image, with an explanation, where video can't be recorded (AC-2)", async ({ page }) => {
    await page.addInitScript(() => {
      // Simulate a browser with neither WebCodecs nor MediaRecorder.
      // @ts-expect-error — deleting built-ins on purpose
      delete window.VideoEncoder;
      // @ts-expect-error — deleting built-ins on purpose
      delete window.MediaRecorder;
    });
    await openShowroom(page);
    await page.getByRole("button", { name: "Capture Video" }).click();

    const dialog = page.getByRole("dialog", { name: "Your Build" });
    await expect(dialog).toBeVisible({ timeout: 60000 });
    await expect(dialog).toContainText("Video capture isn’t supported in this browser");
    await expect(dialog.getByRole("button", { name: "Save Image" })).toBeVisible();
  });
});
