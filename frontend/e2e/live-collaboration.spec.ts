import { expect, test, type Page } from "@playwright/test";

// Spec 33 — two people, two separate browser contexts (no shared cookies or storage), one live
// session. Two WebGL scenes at once are slow under this headless browser's software rendering,
// so the budgets are generous; the one-second relay target is measured precisely in
// backend/tests/integration/liveSession.int.test.ts instead.
test.describe.configure({ mode: "serial" });

async function sceneReady(page: Page) {
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 90000 });
}

async function summaryTotal(page: Page): Promise<string> {
  return (await page.getByTestId("build-summary-total").textContent())!.trim();
}

test("two people configure the same build live: presence, a change reaching the other, and leaving (AC-1–AC-3, AC-7)", async ({
  browser,
}) => {
  test.setTimeout(600_000);
  const alexContext = await browser.newContext();
  const samContext = await browser.newContext();
  const alex = await alexContext.newPage();
  const sam = await samContext.newPage();

  try {
    // AC-1: Alex starts a live session from the configurator.
    await alex.goto("/configure/apex-gt");
    await sceneReady(alex);
    await alex.getByRole("button", { name: "Start Live Session" }).click({ timeout: 60000 });
    await alex.getByLabel("Your name").fill("Alex");
    await alex.getByRole("button", { name: "Start Live Session" }).click({ timeout: 60000 });
    await expect(alex).toHaveURL(/\/configure\/apex-gt\/live\/[A-Za-z0-9_-]{16}$/, { timeout: 60000 });
    const link = alex.url();
    await expect(alex.getByTestId("live-participants")).toContainText("Alex", { timeout: 60000 });

    // AC-2: Sam opens the link, picks a name, joins — both see both.
    await sam.goto(link);
    await sam.getByLabel("Your name").fill("Sam");
    await sam.getByRole("button", { name: "Join" }).click({ timeout: 60000 });
    await expect(sam.getByTestId("live-participants")).toContainText("Alex", { timeout: 60000 });
    await expect(sam.getByTestId("live-participants")).toContainText("Sam(you)");
    await expect(alex.getByTestId("live-participants")).toContainText("Sam", { timeout: 30000 });
    await sceneReady(sam);

    // AC-3: Alex changes the wheels; Sam's summary and price follow, and Sam is told who did it.
    await alex.getByRole("button", { name: /Wheels:.*Sport Wheels/ }).click({ timeout: 120000 });
    await expect(alex.getByLabel("Your build summary").getByText("Wheels: Sport Wheels")).toBeVisible({ timeout: 60000 });
    await expect(sam.getByLabel("Your build summary").getByText("Wheels: Sport Wheels")).toBeVisible({ timeout: 30000 });
    await expect(sam.getByText("Alex changed the Wheels")).toBeVisible({ timeout: 30000 });
    await expect.poll(() => summaryTotal(sam), { timeout: 30000 }).toBe(await summaryTotal(alex));

    // AC-7: Sam's browser goes away without any "leave" (the Leave button itself is covered by
    // LiveSessionPanel.test.tsx); Alex sees only themself within a few seconds.
    await samContext.close();
    await expect(alex.getByTestId("live-participants")).not.toContainText("Sam", { timeout: 15000 });
  } finally {
    await alexContext.close();
    await samContext.close();
  }
});

test("a link to a session that doesn't exist says so, and offers a solo configurator", async ({ page }) => {
  await page.goto("/configure/apex-gt/live/AAAAAAAAAAAAAAAA");
  await expect(page.getByRole("heading", { name: "Live session not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Configure on Your Own" })).toHaveAttribute("href", "/configure/apex-gt");
});
