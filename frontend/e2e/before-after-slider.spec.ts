import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Spec 36 — a CarAI recommendation card gets a before/after slider, made by a hidden 3D
// studio. CarAI's backend is mocked like Spec 15's own E2E (no paid AI calls).
//
// WebGL is switched off for the main showroom only (it falls back to its static image), and
// left ON for the hidden studio's canvas — so the page stays responsive under this headless
// browser's software rendering, while the studio really renders both pictures.

const BACKEND_URL = "http://localhost:4000";

async function paintAlternative(request: APIRequestContext, slug: string) {
  const { data } = await (await request.get(`${BACKEND_URL}/api/vehicles/${slug}`)).json();
  const paints = data.options.PAINT as Array<{ id: string; name: string; priceDeltaCents: number; isDefault: boolean; assetRef: string }>;
  const alt = paints.find((o) => !o.isDefault && o.assetRef !== "paint-custom")!;
  return { alt, basePriceCents: data.basePriceCents as number, currency: data.currency as string };
}

async function setUp(page: Page, request: APIRequestContext, { studioWebGL, slug = "apex-gt" }: { studioWebGL: boolean; slug?: string }) {
  const { alt, basePriceCents, currency } = await paintAlternative(request, slug);
  await page.addInitScript((allowStudio: boolean) => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error — overriding with a narrower signature is fine for this test double.
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      const isWebGL = type === "webgl" || type === "webgl2" || type === "experimental-webgl";
      const inStudio = Boolean(this.closest?.("[data-testid='comparison-studio']"));
      if (isWebGL && !(allowStudio && inStudio)) return null;
      return originalGetContext.apply(this, [type, ...args] as never);
    };
  }, studioWebGL);
  await page.route("**/api/ai/configure", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          assistantMessage: "A bolder color would suit it.",
          recommendation: { singleSelections: { PAINT: alt.id }, multiSelections: {} },
          breakdown: {
            vehicleSlug: slug,
            basePriceCents,
            lineItems: [{ optionId: alt.id, category: "PAINT", name: alt.name, priceDeltaCents: alt.priceDeltaCents }],
            totalPriceCents: basePriceCents + alt.priceDeltaCents,
            currency,
          },
        },
      }),
    }),
  );
  await page.goto(`/configure/${slug}`);
  await expect(page.getByText(/3D preview unavailable/i)).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Ask CarAI" }).click();
  const chat = page.getByRole("dialog", { name: "Ask CarAI" });
  await chat.getByPlaceholder(/Ask CarAI/).fill("Make it bolder");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat.getByText("A bolder color would suit it.")).toBeVisible();
  // The page shows whole euros; the API works in cents.
  return { chat, alt, expectedTotal: Math.round((basePriceCents + alt.priceDeltaCents) / 100) };
}

async function readTotal(page: Page): Promise<number> {
  return Number((await page.getByTestId("total-price").textContent())!.replace(/[^\d]/g, ""));
}

test("a recommendation shows a before/after slider of two real renders; dragging it applies nothing, and Apply still works (AC-1–AC-4)", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const { chat, expectedTotal } = await setUp(page, request, { studioWebGL: true });
  const totalBefore = await readTotal(page);

  const slider = chat.getByRole("slider", { name: "Compare your current build with CarAI's suggestion" });
  await expect(slider).toBeVisible({ timeout: 90000 });
  const before = chat.getByRole("img", { name: "Your current build" });
  const after = chat.getByRole("img", { name: "Your build with CarAI's suggestion applied" });
  const beforeSrc = await before.getAttribute("src");
  const afterSrc = await after.getAttribute("src");
  expect(beforeSrc).toMatch(/^data:image\/jpeg;base64,/);
  expect(afterSrc).toMatch(/^data:image\/jpeg;base64,/);
  expect(beforeSrc).not.toBe(afterSrc); // two genuinely different renders
  expect(await after.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(640);
  await expect(page.getByTestId("comparison-studio")).toHaveCount(0); // the hidden studio is gone again

  // Keyboard and pointer both move it; neither changes the build.
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveAttribute("aria-valuenow", "100");
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(slider).toHaveAttribute("aria-valuenow", "75");
  expect(await readTotal(page)).toBe(totalBefore);

  // Apply is exactly Spec 15's.
  await chat.getByRole("button", { name: "Apply Configuration" }).click();
  await expect(chat.getByRole("button", { name: "Applied" })).toBeDisabled();
  await expect.poll(() => readTotal(page)).toBe(expectedTotal);
});

test("without WebGL, the card falls back to its plain list and Apply still works (§5 Error)", async ({ page, request }) => {
  test.setTimeout(120_000);
  const { chat, alt, expectedTotal } = await setUp(page, request, { studioWebGL: false });

  await expect(chat.getByTestId("comparison-preparing")).toHaveCount(0, { timeout: 30000 });
  await expect(chat.getByRole("slider")).toHaveCount(0);
  await expect(chat.getByText(alt.name)).toBeVisible();
  await chat.getByRole("button", { name: "Apply Configuration" }).click();
  await expect.poll(() => readTotal(page)).toBe(expectedTotal);
});

// A real, heavy GLB model: rapidly re-creating 3D contexts with one loaded once crashed this app
// ("Context Lost" — see next.config.ts). The studio keeps ONE hidden 3D view per batch, so two
// recommendations in a row must render cleanly, with no lost context or page error.
test("on a real-model car, a batch of two recommendations renders cleanly — no lost 3D context", async ({ page, request }) => {
  test.setTimeout(240_000);
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (/context lost|CONTEXT_LOST|webglcontextlost/i.test(msg.text())) problems.push(msg.text());
  });
  page.on("pageerror", (err) => problems.push(err.message));

  const { chat } = await setUp(page, request, { studioWebGL: true, slug: "porsche-992-gt3-r" });
  await chat.getByPlaceholder(/Ask CarAI/).fill("Another idea?");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat.getByText("A bolder color would suit it.")).toHaveCount(2);

  const sliders = chat.getByRole("slider", { name: "Compare your current build with CarAI's suggestion" });
  await expect(sliders).toHaveCount(2, { timeout: 150_000 });
  for (const name of ["Your current build", "Your build with CarAI's suggestion applied"]) {
    for (const img of await chat.getByRole("img", { name }).all()) {
      expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(640);
    }
  }
  const [beforeSrc, afterSrc] = await Promise.all([
    chat.getByRole("img", { name: "Your current build" }).first().getAttribute("src"),
    chat.getByRole("img", { name: "Your build with CarAI's suggestion applied" }).first().getAttribute("src"),
  ]);
  expect(beforeSrc).not.toBe(afterSrc); // the real model's paint really changed
  await expect(page.getByTestId("comparison-studio")).toHaveCount(0);
  expect(problems).toEqual([]);
});
