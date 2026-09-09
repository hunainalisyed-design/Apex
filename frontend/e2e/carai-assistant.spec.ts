import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const BACKEND_URL = "http://localhost:4000";

interface AltOption {
  id: string;
  name: string;
  priceDeltaCents: number;
}

async function getWheelsAlternative(
  request: APIRequestContext,
  slug: string,
): Promise<{ basePriceCents: number; currency: string; alt: AltOption }> {
  const res = await request.get(`${BACKEND_URL}/api/vehicles/${slug}`);
  const { data } = await res.json();
  const wheels = data.options.WHEELS as (AltOption & { isDefault: boolean })[];
  const alt = wheels.find((o) => !o.isDefault)!;
  return { basePriceCents: data.basePriceCents, currency: data.currency, alt };
}

async function readTotalPrice(page: Page): Promise<number> {
  const text = await page.getByTestId("total-price").textContent();
  return Number(text!.replace(/[^\d]/g, ""));
}

async function mockAiConfigure(
  page: Page,
  body: { assistantMessage: string; recommendation: unknown; breakdown: unknown },
  status = 200,
) {
  await page.route("**/api/ai/configure", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: status === 200 ? JSON.stringify({ data: body }) : JSON.stringify(body),
    }),
  );
}

test.describe("CarAI assistant (Spec 15)", () => {
  test("open chat, send a message, apply the recommendation, and see the 3D/price update identically to a manual selection (AC-1, AC-4, AC-5, AC-7)", async ({
    page,
    request,
  }) => {
    const { basePriceCents, currency, alt } = await getWheelsAlternative(request, "apex-gt");
    const newTotal = basePriceCents + alt.priceDeltaCents;

    await mockAiConfigure(page, {
      assistantMessage: "Here's a sportier build for you.",
      recommendation: { singleSelections: { WHEELS: alt.id }, multiSelections: {} },
      breakdown: {
        vehicleSlug: "apex-gt",
        basePriceCents,
        lineItems: [{ optionId: alt.id, category: "WHEELS", name: alt.name, priceDeltaCents: alt.priceDeltaCents }],
        totalPriceCents: newTotal,
        currency,
      },
    });

    await page.goto("/configure/apex-gt");
    await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

    await page.getByRole("button", { name: "Ask CarAI" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.getByPlaceholder(/Ask CarAI/).fill("Make it sportier");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(dialog.getByText("Here's a sportier build for you.")).toBeVisible();
    await expect(dialog.getByText(alt.name)).toBeVisible();

    await dialog.getByRole("button", { name: "Apply Configuration" }).click();

    await expect(dialog.getByRole("button", { name: "Applied" })).toBeVisible();
    // The same pipeline a manual swatch click triggers — the header's real total-price
    // reflects the applied recommendation, not just the chat's own copy of the number.
    await expect.poll(() => readTotalPrice(page)).toBe(Math.round(newTotal / 100));
  });

  test("shows an inline error bubble when the request fails, without breaking the rest of the configurator (AC-8)", async ({
    page,
  }) => {
    await mockAiConfigure(
      page,
      { code: "AI_PROVIDER_ERROR", message: "raw detail should never show" } as never,
      502,
    );

    await page.goto("/configure/apex-gt");
    await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

    await page.getByRole("button", { name: "Ask CarAI" }).click();
    await page.getByPlaceholder(/Ask CarAI/).fill("hello");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText(/temporarily unavailable/)).toBeVisible();
    await expect(page.getByText("raw detail should never show")).not.toBeVisible();

    // The rest of the configurator remains fully usable — closing the floating overlay
    // (as any real user would to keep configuring manually) rather than clicking blindly
    // through/around it, which the chat's own panel legitimately overlaps.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByRole("tab", { name: "Exterior" }).click();
    await expect(page.getByRole("tab", { name: "Exterior" })).toHaveAttribute("aria-selected", "true");
  });

  test("the nav's Ask CarAI control navigates into the default vehicle's showroom and opens the chat automatically (AC-2)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Ask CarAI" }).click();

    await expect(page).toHaveURL(/\/configure\/apex-gt$/);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("resolves to the currently-open vehicle, not the default, when already on a different vehicle's showroom (AC-2)", async ({
    page,
  }) => {
    await page.goto("/configure/apex-rs");
    await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

    await page.getByRole("link", { name: "Ask CarAI" }).click();

    await expect(page).toHaveURL(/\/configure\/apex-rs$/);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("chat history resets when switching vehicles via client-side navigation, not just a hard reload (AC-9)", async ({
    page,
  }) => {
    await mockAiConfigure(page, { assistantMessage: "Reply for GT.", recommendation: null, breakdown: null });

    await page.goto("/configure/apex-gt");
    await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

    await page.getByRole("button", { name: "Ask CarAI" }).click();
    await page.getByPlaceholder(/Ask CarAI/).fill("hi");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Reply for GT.")).toBeVisible();

    // Close the floating overlay before navigating elsewhere — it legitimately overlaps
    // part of the page, same as any real floating widget, and a real user would close it
    // before continuing rather than click blindly through/around it.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Client-side navigation to a different vehicle (via Models), not page.goto — otherwise
    // a hard reload would trivially reset every module's state and this wouldn't actually
    // exercise the reset-on-vehicle-change effect at all.
    await page.getByRole("link", { name: "Models" }).click();
    await page.getByRole("link", { name: /Apex RS/ }).click();
    await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

    await page.getByRole("button", { name: "Ask CarAI" }).click();
    await expect(page.getByText("Reply for GT.")).not.toBeVisible();
    await expect(page.getByText(/Tell me what you're looking for/)).toBeVisible();
  });

  test.describe("mobile viewport", () => {
    test.use({ viewport: { width: 375, height: 800 } });

    test("the chat window takes over as a full-screen sheet (AC-12)", async ({ page }) => {
      await page.goto("/configure/apex-gt");
      await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

      await page.getByRole("button", { name: "Ask CarAI" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const box = await dialog.boundingBox();
      const viewport = page.viewportSize()!;
      expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 4);
      expect(box!.height).toBeGreaterThanOrEqual(viewport.height - 4);
    });
  });
});
