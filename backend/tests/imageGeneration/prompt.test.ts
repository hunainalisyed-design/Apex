import { afterEach, describe, expect, it, vi } from "vitest";
import type { PriceLineItemDto } from "../../src/types/pricing.js";

vi.mock("../../src/lib/prisma.js", () => ({ prisma: {} }));

const { buildConceptPrompt } = await import("../../src/services/imageGeneration/buildConceptPrompt.js");
const { placeholderProvider, wrap } = await import("../../src/services/imageGeneration/placeholderProvider.js");
const {
  generateConceptImage,
  getImageGenerationProvider,
  GENERATION_TIMEOUT_MS,
  GLOBAL_DAILY_LIMIT,
  ImageProviderError,
  isConceptRendersEnabled,
  MAX_IMAGE_BYTES,
  resetDailyCapForTests,
  setImageGenerationProviderForTests,
  takeDailySlot,
} = await import("../../src/services/imageGeneration/index.js");

function item(category: PriceLineItemDto["category"], name: string): PriceLineItemDto {
  return { optionId: `${category}-${name}`, category, name, priceDeltaCents: 0 };
}

const BUILD = [
  item("PAINT", "Racing Red"),
  item("WHEELS", "Sport Wheels"),
  item("BRAKE_CALIPER", "Red"),
  item("WINDOW_TINT", "None"),
  item("SPOILER", "Carbon Wing"),
  item("INTERIOR_MATERIAL", "Alcantara"),
  item("ACCESSORY", "Carbon Mirror Caps"),
  item("PACKAGE", "Performance Package"),
];

describe("buildConceptPrompt (Spec 35, AC-1)", () => {
  it("describes the vehicle and its visible choices, and asks for a more extreme version", () => {
    const prompt = buildConceptPrompt("Apex GT", BUILD, null);
    expect(prompt).toContain("an even more extreme");
    expect(prompt).toContain("Apex GT");
    expect(prompt).toContain("Racing Red paint, Sport Wheels wheels, Red brake calipers, Carbon Wing spoiler");
    expect(prompt).toContain("Carbon Mirror Caps accessory, Performance Package package");
    expect(prompt).toContain("No text, no logos, no watermarks, no people.");
  });

  it("leaves out defaults like 'None' and the interior (an exterior hero shot)", () => {
    const prompt = buildConceptPrompt("Apex GT", BUILD, null);
    expect(prompt).not.toContain("None");
    expect(prompt).not.toContain("Alcantara");
  });

  it("describes a custom paint by its color", () => {
    const prompt = buildConceptPrompt("Apex GT", [item("PAINT", "Custom Color")], "#1f4b8f");
    expect(prompt).toContain("custom paint in color #1f4b8f");
    expect(prompt).not.toContain("Custom Color paint");
  });

  it("still makes a sensible prompt for an all-default build", () => {
    const prompt = buildConceptPrompt("Apex GT", [item("WINDOW_TINT", "None"), item("WHEELS", "Standard Wheels")], null);
    expect(prompt).not.toContain("Keep its character");
    expect(prompt).toContain("Apex GT");
  });
});

describe("placeholder provider (Spec 35, Risk #1 — no real vendor yet)", () => {
  it("makes a clearly-labeled SVG locally, at no cost", async () => {
    const image = await placeholderProvider.generate("A <bold> & 'quoted' prompt", { signal: new AbortController().signal });
    const svg = image.data.toString("utf8");
    expect(image.contentType).toBe("image/svg+xml");
    expect(svg).toContain("DEVELOPMENT PLACEHOLDER");
    expect(svg).toContain("A &lt;bold&gt; &amp; &apos;quoted&apos; prompt"); // escaped, so it can't break the SVG
    expect(placeholderProvider).toMatchObject({ isPlaceholder: true, estimatedCostUsd: 0 });
  });

  it("wraps text into lines and marks a cut", () => {
    expect(wrap("one two three four", 9, 5)).toEqual(["one two", "three", "four"]);
    expect(wrap("aaa bbb ccc ddd eee", 7, 2)).toEqual(["aaa bbb", "ccc ddd…"]);
    expect(wrap("", 10, 3)).toEqual([]);
  });
});

describe("provider selection and the flag", () => {
  afterEach(() => {
    delete process.env.IMAGE_PROVIDER;
    delete process.env.CONCEPT_RENDERS_ENABLED;
    setImageGenerationProviderForTests(undefined);
  });

  it("is off unless CONCEPT_RENDERS_ENABLED is exactly 'true'", () => {
    expect(isConceptRendersEnabled()).toBe(false);
    process.env.CONCEPT_RENDERS_ENABLED = "yes";
    expect(isConceptRendersEnabled()).toBe(false);
    process.env.CONCEPT_RENDERS_ENABLED = "true";
    expect(isConceptRendersEnabled()).toBe(true);
  });

  it("has no provider unless one is configured; 'placeholder' is the only one today", () => {
    expect(getImageGenerationProvider()).toBeNull();
    process.env.IMAGE_PROVIDER = "some-vendor";
    expect(getImageGenerationProvider()).toBeNull();
    process.env.IMAGE_PROVIDER = "placeholder";
    expect(getImageGenerationProvider()).toBe(placeholderProvider);
  });
});

describe("generateConceptImage", () => {
  const provider = (generate: (prompt: string, o: { signal: AbortSignal }) => Promise<{ data: Buffer; contentType: string }>) => ({
    name: "fake",
    isPlaceholder: false,
    estimatedCostUsd: 0.01,
    generate,
  });

  afterEach(() => vi.useRealTimers());

  it("returns the image as a data: URL", async () => {
    const url = await generateConceptImage(provider(async () => ({ data: Buffer.from("png-bytes"), contentType: "image/png" })), "p", {
      vehicleSlug: "apex-gt",
    });
    expect(url).toBe(`data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`);
  });

  it("turns any provider failure into ImageProviderError (AC-4)", async () => {
    await expect(
      generateConceptImage(provider(async () => Promise.reject(new Error("HTTP 500 from vendor, secret detail"))), "p", { vehicleSlug: "apex-gt" }),
    ).rejects.toThrow(new ImageProviderError("provider failed"));
  });

  it("rejects something that isn't a usable image", async () => {
    await expect(generateConceptImage(provider(async () => ({ data: Buffer.from("<html>"), contentType: "text/html" })), "p", { vehicleSlug: "x" })).rejects.toBeInstanceOf(ImageProviderError);
    await expect(generateConceptImage(provider(async () => ({ data: Buffer.alloc(0), contentType: "image/png" })), "p", { vehicleSlug: "x" })).rejects.toBeInstanceOf(ImageProviderError);
    await expect(generateConceptImage(provider(async () => ({ data: Buffer.alloc(MAX_IMAGE_BYTES + 1), contentType: "image/png" })), "p", { vehicleSlug: "x" })).rejects.toBeInstanceOf(ImageProviderError);
  });

  it("gives up after the timeout, and tells the provider to stop", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const pending = generateConceptImage(
      provider((_p, o) => {
        signal = o.signal;
        return new Promise(() => {});
      }),
      "p",
      { vehicleSlug: "apex-gt" },
    );
    const assertion = expect(pending).rejects.toThrow(new ImageProviderError("timed out"));
    await vi.advanceTimersByTimeAsync(GENERATION_TIMEOUT_MS);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });
});

describe("site-wide daily cap (Spec 35, Risk #2)", () => {
  afterEach(() => resetDailyCapForTests());

  it(`allows ${GLOBAL_DAILY_LIMIT} a day across the site, then resets the next UTC day`, () => {
    const day1 = new Date("2026-09-27T10:00:00.000Z");
    for (let i = 0; i < GLOBAL_DAILY_LIMIT; i++) expect(takeDailySlot(day1)).toBe(true);
    expect(takeDailySlot(day1)).toBe(false);
    expect(takeDailySlot(new Date("2026-09-27T23:59:59.000Z"))).toBe(false);
    expect(takeDailySlot(new Date("2026-09-28T00:00:01.000Z"))).toBe(true);
  });
});
