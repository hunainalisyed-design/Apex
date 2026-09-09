import { expect, test } from "@playwright/test";

test.describe("Scroll showcase — desktop, live scene (Spec 13, AC-8, AC-9, AC-11)", () => {
  test("scrolling at normal and fast speed never overrides the user's own scroll position (AC-9)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "BUILD YOUR VISION." })).toBeVisible();
    // Wait for the live scene to mount (Hero's canvas + the showcase's own) before
    // measuring anything scroll-height-related — useIsDesktopViewport's SSR-safe default
    // briefly renders the shorter static fallback first, so measuring too early would
    // capture that transient, much-shorter page height instead of the settled one.
    await expect(page.locator("canvas")).toHaveCount(2, { timeout: 10000 });

    // Normal-speed scroll via a native wheel event.
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(200);
    const afterNormal = await page.evaluate(() => window.scrollY);
    expect(afterNormal).toBeGreaterThan(0);

    // Fast/large synthetic scroll — a direct native scrollTo, not animation-mediated.
    // ScrollTrigger's scrub only reads this value each tick; it must never clamp or
    // snap it back.
    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    const target = Math.floor(maxScroll * 0.6);
    await page.evaluate((y) => window.scrollTo(0, y), target);
    const afterFast = await page.evaluate(() => window.scrollY);
    expect(afterFast).toBe(target);
  });

  test("the configuration summary CTA is reachable at the end of the sequence and links into the configurator (AC-11)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toHaveCount(2, { timeout: 10000 });

    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    await page.evaluate((y) => window.scrollTo(0, y), maxScroll);
    await page.waitForTimeout(300);

    // Hero has its own "Configure Your Car" link too — the showcase's summary CTA is the
    // later one in DOM order, revealed once scroll reaches the final beat.
    const cta = page.getByRole("link", { name: "Configure Your Car" }).last();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/configure/apex-gt");
  });
});

test.describe("Scroll showcase — mobile viewport (Spec 13, AC-12)", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("never mounts a live Canvas for the showcase; shows the stacked-image fallback instead", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "BUILD YOUR VISION." })).toBeVisible();

    // Hero's own canvas is unaffected by Spec 13 and mounts regardless of viewport — wait
    // for it, then confirm the showcase below it never adds a second one.
    await expect(page.locator("canvas")).toHaveCount(1, { timeout: 10000 });
    await page.waitForTimeout(500);
    await expect(page.locator("canvas")).toHaveCount(1);

    await expect(page.getByText("Every line, sculpted for performance.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Configure Your Car" }).last()).toHaveAttribute(
      "href",
      "/configure/apex-gt",
    );
  });
});
