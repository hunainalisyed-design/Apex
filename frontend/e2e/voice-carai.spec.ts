import { expect, test, type Page } from "@playwright/test";

// Spec 34 — the browser's speech features are replaced before the page loads: a fake
// SpeechRecognition the test "speaks" into, and a fake speechSynthesis that records what's read
// aloud. CarAI's backend is mocked like Spec 15's own E2E (no paid AI calls).
//
// WebGL is switched off (as in webgl-fallback.spec.ts): voice has nothing to do with the 3D scene,
// and the chat is there either way — but a software-rendered scene makes every click on this
// headless browser crawl, which would test the machine, not the feature.

declare global {
  interface Window {
    __say: (words: string) => void;
    __spoken: string[];
  }
}

async function installFakeSpeech(page: Page, { recognition = true }: { recognition?: boolean } = {}) {
  await disableWebGL(page);
  await page.addInitScript((withRecognition: boolean) => {
    window.__spoken = [];
    const listening: { session: { onresult: ((e: unknown) => void) | null; onend: (() => void) | null } | null } = { session: null };
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        listening.session = this;
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    window.__say = (words: string) => {
      const session = listening.session;
      if (!session) throw new Error("not listening");
      session.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: words }], { isFinal: true })] });
      session.onend?.();
      listening.session = null;
    };
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
    if (withRecognition) w.webkitSpeechRecognition = FakeRecognition;

    class FakeUtterance {
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      lang = "";
      constructor(public text: string) {}
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: FakeUtterance, configurable: true });
    Object.defineProperty(window, "speechSynthesis", {
      value: { speak: (u: FakeUtterance) => window.__spoken.push(u.text), cancel: () => {} },
      configurable: true,
    });
  }, recognition);
}

async function disableWebGL(page: Page) {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error — overriding with a narrower signature is fine for this test double.
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return originalGetContext.apply(this, [type, ...args] as never);
    };
  });
}

async function mockCarAi(page: Page, assistantMessage: string) {
  const requests: Array<{ message: string }> = [];
  await page.route("**/api/ai/configure", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { assistantMessage, recommendation: null, breakdown: null } }),
    });
  });
  return requests;
}

async function openCarAi(page: Page) {
  await page.goto("/configure/apex-gt");
  await expect(page.getByText(/3D preview unavailable/i)).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Ask CarAI" }).click();
  return page.getByRole("dialog", { name: "Ask CarAI" });
}

test("a spoken request fills the message box and goes out exactly like a typed one (AC-1, AC-2)", async ({ page }) => {
  await installFakeSpeech(page);
  const requests = await mockCarAi(page, "Here's a more aggressive build.");
  const chat = await openCarAi(page);

  await chat.getByRole("button", { name: "Speak your request" }).click();
  await expect(chat.getByText("Listening… speak now")).toBeVisible();
  await page.evaluate(() => window.__say("make it more aggressive"));
  await expect(chat.getByPlaceholder(/Ask CarAI/)).toHaveValue("make it more aggressive");
  expect(requests).toHaveLength(0); // nothing sent until Send

  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat.getByText("Here's a more aggressive build.")).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].message).toBe("make it more aggressive");
  await expect(chat.getByText("make it more aggressive")).toBeVisible();
});

test("speak replies is off by default, reads replies once turned on, and is remembered (AC-3, AC-4)", async ({ page }) => {
  await installFakeSpeech(page);
  await mockCarAi(page, "Carbon trim added.");
  let chat = await openCarAi(page);
  const toggle = chat.getByRole("button", { name: "Speak CarAI's replies aloud" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await chat.getByPlaceholder(/Ask CarAI/).fill("add carbon trim");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat.getByText("Carbon trim added.")).toBeVisible();
  expect(await page.evaluate(() => window.__spoken)).toEqual([]);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await chat.getByPlaceholder(/Ask CarAI/).fill("and again");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect.poll(() => page.evaluate(() => window.__spoken)).toEqual(["Carbon trim added."]);

  await page.reload();
  chat = await openCarAi(page);
  await expect(chat.getByRole("button", { name: "Speak CarAI's replies aloud" })).toHaveAttribute("aria-pressed", "true");
});

test("without speech recognition there's no microphone, and typing still works (AC-1)", async ({ page }) => {
  await installFakeSpeech(page, { recognition: false });
  await mockCarAi(page, "Typed just fine.");
  const chat = await openCarAi(page);
  await expect(chat.getByRole("button", { name: "Speak your request" })).toHaveCount(0);
  await chat.getByPlaceholder(/Ask CarAI/).fill("hello");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat.getByText("Typed just fine.")).toBeVisible();
});
