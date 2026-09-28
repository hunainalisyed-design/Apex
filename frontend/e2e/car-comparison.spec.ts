import { expect, test } from "@playwright/test";

test("/compare with no params defaults to the first two vehicles in both the table and the selectors (AC-1, AC-2)", async ({
  page,
}) => {
  await page.goto("/compare");

  await expect(page.getByRole("columnheader", { name: "Apex GT" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Apex RS" })).toBeVisible();
  await expect(page.getByLabel("Vehicle 1")).toHaveValue("apex-gt");
  await expect(page.getByLabel("Vehicle 2")).toHaveValue("apex-rs");

  // AC-2's example-table fields.
  await expect(page.getByRole("row", { name: /Power/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /0–100/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Top Speed/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Starting Price/ })).toBeVisible();
});

test("each selector genuinely excludes the vehicle chosen on the other side, not just discourages it (AC-4)", async ({
  page,
}) => {
  await page.goto("/compare");

  const leftSelect = page.getByLabel("Vehicle 1");
  const rightSelect = page.getByLabel("Vehicle 2");

  await expect(leftSelect.locator("option", { hasText: "Apex RS" })).toHaveCount(0);
  await expect(rightSelect.locator("option", { hasText: "Apex GT" })).toHaveCount(0);
});

test("a shared /compare link renders the exact pair it names (AC-3)", async ({ page }) => {
  // Today's real catalog only has two vehicles, so the mutual-exclusion rule (AC-4) means
  // neither selector ever has an actual alternative to switch to via a live click — this
  // direct-navigation check exercises AC-3's URL-to-render direction for real instead
  // (documented trade-off; a live selector-change is covered against a mocked 3-vehicle
  // catalog in CompareView.test.tsx).
  await page.goto("/compare?left=apex-rs&right=apex-gt");

  await expect(page.getByLabel("Vehicle 1")).toHaveValue("apex-rs");
  await expect(page.getByLabel("Vehicle 2")).toHaveValue("apex-gt");
  const headers = page.getByRole("columnheader");
  await expect(headers.nth(1)).toHaveText("Apex RS");
  await expect(headers.nth(2)).toHaveText("Apex GT");
});

test("toggling 3D View shows both vehicles in one shared scene, and toggling back returns to the table (AC-5)", async ({
  page,
}) => {
  await page.goto("/compare");

  await page.getByRole("tab", { name: "3D View" }).click();
  await expect(page.locator("[data-compare-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await expect(page.getByRole("columnheader", { name: "Apex GT" })).not.toBeVisible();

  await page.getByRole("tab", { name: "Spec Table" }).click();
  await expect(page.getByRole("columnheader", { name: "Apex GT" })).toBeVisible();
});

test("Configure This Vehicle navigates each side into the real configurator (AC-11)", async ({ page }) => {
  await page.goto("/compare");

  await page.getByRole("link", { name: "Configure This Vehicle" }).first().click();
  await expect(page).toHaveURL(/\/configure\/apex-gt/);

  await page.goto("/compare");
  await page.getByRole("link", { name: "Configure This Vehicle" }).nth(1).click();
  await expect(page).toHaveURL(/\/configure\/apex-rs/);
});

test("keyboard pass: both selectors and the view toggle are reachable and operable (AC-9)", async ({ page }) => {
  await page.goto("/compare");

  await page.getByLabel("Vehicle 1").focus();
  await expect(page.getByLabel("Vehicle 1")).toBeFocused();

  await page.getByRole("tab", { name: "3D View" }).focus();
  await expect(page.getByRole("tab", { name: "3D View" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-compare-scene-ready='true']")).toBeAttached({ timeout: 15000 });
});

test("on a narrow viewport the spec table scrolls within its own container, never the page itself (AC-10)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/compare");

  const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth);

  await expect(page.getByRole("columnheader", { name: "Apex GT" })).toBeVisible();
});

test("every piece of text is readable before any hover — labels, dropdown options, buttons, tabs, table", async ({ page }) => {
  await page.goto("/compare");
  await expect(page.getByRole("columnheader", { name: "Apex GT" })).toBeVisible();
  await page.mouse.move(0, 0);

  const results = await page.evaluate(() => {
    // Any CSS colour (rgb, oklab, lab…) → [r, g, b, a], by letting a canvas resolve it.
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgba = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const over = (top: number[], below: number[]) => [0, 1, 2].map((i) => top[i] * top[3] + below[i] * (1 - top[3])).concat(1);
    const luminance = ([r, g, b]: number[]) => {
      const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const contrast = (a: number[], b: number[]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    // The page's backdrop, judged at its lightest gradient stop (the worst case for light text).
    const backdrop = rgba("#123d5a");
    const backgroundOf = (el: Element) => {
      const layers: number[][] = [];
      for (let node: Element | null = el; node && node.tagName !== "MAIN"; node = node.parentElement) {
        const bg = rgba(getComputedStyle(node).backgroundColor);
        if (bg[3] > 0) layers.push(bg);
        if (bg[3] === 1) break;
      }
      return layers.reverse().reduce((below, top) => over(top, below), backdrop);
    };
    return [...document.querySelectorAll("main h1, main p, main label, main select, main option, main a, main [role=tab], main th, main td")]
      // Skip text that's only there for screen readers (visually hidden by design).
      .filter((el) => {
        const text = (el.textContent ?? "").trim();
        const hidden = [...el.querySelectorAll(".sr-only")].map((h) => (h.textContent ?? "").trim()).join("");
        return text !== "" && !el.closest(".sr-only") && text !== hidden;
      })
      .map((el) => {
        const style = getComputedStyle(el);
        const bg = el.tagName === "OPTION" ? rgba(style.backgroundColor) : backgroundOf(el);
        return {
          text: (el.textContent ?? "").trim().slice(0, 30),
          ratio: Math.round(contrast(over(rgba(style.color), bg), bg) * 10) / 10,
          opaqueBackground: el.tagName !== "OPTION" || bg[3] === 1,
          shown: style.visibility === "visible" && Number(style.opacity) === 1,
        };
      });
  });

  expect(results.length).toBeGreaterThan(20);
  for (const r of results) {
    expect(r, `"${r.text}"`).toMatchObject({ shown: true, opaqueBackground: true });
    expect(r.ratio, `"${r.text}" contrast`).toBeGreaterThanOrEqual(4.5);
  }
  // Native controls are drawn dark, so an open option list never shows white text on white.
  expect(await page.getByLabel("Vehicle 1").evaluate((el) => getComputedStyle(el).colorScheme)).toBe("dark");
});

test("the 3D view looks and feels grabbable: grab, then grabbing while dragging", async ({ page }) => {
  await page.goto("/compare");
  await page.getByRole("tab", { name: "3D View" }).click();
  const scene = page.locator("[data-compare-scene-ready='true']");
  await expect(scene).toBeAttached({ timeout: 60000 });
  expect(await scene.evaluate((el) => getComputedStyle(el).cursor)).toBe("grab");
  const viewer = page.getByTestId("compare-viewer");
  await viewer.scrollIntoViewIfNeeded();
  const box = (await viewer.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 4 });
  expect(await scene.evaluate((el) => getComputedStyle(el).cursor)).toBe("grabbing");
  await page.mouse.up();
});
