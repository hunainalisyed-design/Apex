import { expect, test, type Page } from "@playwright/test";

// Spec 29 — sound design. Runs the real Web Audio pipeline in the browser; the only test
// double is instrumentation: each decoded AudioBuffer is tagged with the URL it came from,
// and every AudioBufferSourceNode.start() records which file actually began playing.
async function instrumentAudio(page: Page) {
  await page.addInitScript(() => {
    const urlOf = new WeakMap<object, string>();
    const played: string[] = [];
    (window as unknown as { __played: string[] }).__played = played;

    const originalArrayBuffer = Response.prototype.arrayBuffer;
    Response.prototype.arrayBuffer = async function () {
      const data = await originalArrayBuffer.call(this);
      // Only tag audio. three.js's loaders re-wrap downloads in a new Response (url "") to
      // track progress — never let the instrumentation throw on, or alter, other loads.
      if (this.url.includes("/audio/")) urlOf.set(data, new URL(this.url).pathname);
      return data;
    };
    const originalDecode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = async function (this: BaseAudioContext, data: ArrayBuffer) {
      const url = urlOf.get(data);
      const buffer = await originalDecode.call(this, data);
      if (url) urlOf.set(buffer, url);
      return buffer;
    } as typeof originalDecode;
    const originalStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof originalStart>) {
      if (this.buffer) played.push(urlOf.get(this.buffer) ?? "unknown");
      return originalStart.apply(this, args);
    };
  });
}

const played = (page: Page) => page.evaluate(() => (window as unknown as { __played: string[] }).__played.map((u) => u.replace(/^\/audio\/|\.[0-9a-f]{8}\.mp3$/g, "")));

/** Real-model cars load a multi-megabyte GLB; under headless software rendering (and a dev
 * server compiling on first visit) that can take well over a minute, so they get longer. */
async function openShowroom(page: Page, slug: string, timeout = 60000) {
  await page.goto(`/configure/${slug}`);
  await expect(page.locator("main[data-scene-ready='true']")).toBeVisible({ timeout });
}

test.describe("Sound design (Spec 29)", () => {
  test.setTimeout(300000);

  test("is off by default: nothing is downloaded or played (AC-1)", async ({ page }) => {
    await instrumentAudio(page);
    const audioRequests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/audio/")) audioRequests.push(r.url());
    });
    await openShowroom(page, "apex-gt");
    await page.getByRole("button", { name: "Interior", exact: true }).click();
    await page.waitForTimeout(2000);

    await expect(page.getByRole("button", { name: "Turn showroom sound on" })).toHaveAttribute("aria-pressed", "false");
    expect(audioRequests).toEqual([]);
    expect(await played(page)).toEqual([]);
  });

  test("unmuting plays the engine start and ambience, and the doors play their cues as they swing (AC-2, AC-5)", async ({ page }) => {
    await instrumentAudio(page);
    await openShowroom(page, "apex-gt");

    await page.getByRole("button", { name: "Turn showroom sound on" }).click();
    await expect.poll(() => played(page), { timeout: 20000 }).toEqual(["engine-start", "showroom-ambience"]);

    await page.getByRole("button", { name: "Interior", exact: true }).click();
    await expect.poll(() => played(page), { timeout: 20000 }).toContain("door-open");

    await page.getByRole("button", { name: "Front", exact: true }).click();
    await expect.poll(() => played(page), { timeout: 20000 }).toContain("door-close");

    await page.getByRole("button", { name: /Headlights/ }).click();
    await expect.poll(() => played(page)).toContain("headlight-switch");
  });

  test("remembers the choice across visits (AC-3)", async ({ page }) => {
    await instrumentAudio(page);
    await openShowroom(page, "apex-gt");
    await page.getByRole("button", { name: "Turn showroom sound on" }).click();

    await page.reload();
    await expect(page.locator("main[data-scene-ready='true']")).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole("button", { name: "Turn showroom sound off" })).toHaveAttribute("aria-pressed", "true");
  });

  test("real-model cars get no light controls or door sounds — nothing on screen to match (AC-2)", async ({ page }) => {
    await instrumentAudio(page);
    await openShowroom(page, "porsche-992-gt3-r", 150000);
    await expect(page.getByRole("button", { name: /Headlights/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Turn showroom sound on" }).click();
    await expect.poll(() => played(page), { timeout: 20000 }).toContain("engine-start");
    await page.getByRole("button", { name: "Interior", exact: true }).click();
    await page.waitForTimeout(3000);
    expect(await played(page)).not.toContain("door-open");
  });
});
