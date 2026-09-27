import "dotenv/config";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog.js";
import type { GeneratedImage, ImageGenerationProvider } from "../../src/services/imageGeneration/ImageGenerationProvider.js";

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/lib/prisma.js");
const { seedDatabase } = await import("../../prisma/seed.js");
const { GLOBAL_DAILY_LIMIT, resetDailyCapForTests, setImageGenerationProviderForTests } = await import(
  "../../src/services/imageGeneration/index.js"
);

const app = createApp();
const render = (body: unknown) => request(app).post("/api/ai/concept-render").send(body as object);

let build: {
  vehicleSlug: string;
  singleSelections: Record<string, string>;
  multiSelections: { ACCESSORY: string[]; PACKAGE: string[] };
  customPaintHex: string | null;
};
let customPaintId: string;
let rsWheelsId: string;

/** A provider that records prompts and answers with whatever the test sets. */
const fake = {
  prompts: [] as string[],
  result: (): Promise<GeneratedImage> => Promise.resolve({ data: Buffer.from("fake-png"), contentType: "image/png" }),
};
const fakeProvider: ImageGenerationProvider = {
  name: "fake",
  isPlaceholder: false,
  estimatedCostUsd: 0.003,
  generate: (prompt) => {
    fake.prompts.push(prompt);
    return fake.result();
  },
};

// The per-IP limits (2/minute, 10/day) apply to every request from this test's one IP, so each
// test starts a day later — fresh windows — by moving only Date forward.
let clock = new Date("2030-01-01T12:00:00.000Z").getTime();
function nextDay() {
  clock += 25 * 60 * 60 * 1000;
  vi.setSystemTime(clock);
}

describe("AI concept renders (integration, Spec 35)", () => {
  beforeAll(async () => {
    await seedDatabase(prisma);
    const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { slug: "apex-gt" } });
    const options = await prisma.customizationOption.findMany({ where: { vehicleId: vehicle.id, isActive: true } });
    build = {
      vehicleSlug: "apex-gt",
      singleSelections: Object.fromEntries(SINGLE_SELECT_CATEGORIES.map((c) => [c, options.find((o) => o.category === c && o.isDefault)!.id])),
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
      customPaintHex: null,
    };
    customPaintId = options.find((o) => o.assetRef === "paint-custom")!.id;
    const rs = await prisma.vehicle.findFirstOrThrow({ where: { slug: "apex-rs" } });
    rsWheelsId = (await prisma.customizationOption.findFirstOrThrow({ where: { vehicleId: rs.id, category: "WHEELS" } })).id;
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterAll(() => {
    vi.useRealTimers();
    setImageGenerationProviderForTests(undefined);
    delete process.env.CONCEPT_RENDERS_ENABLED;
  });

  beforeEach(() => {
    nextDay();
    process.env.CONCEPT_RENDERS_ENABLED = "true";
    setImageGenerationProviderForTests(fakeProvider);
    resetDailyCapForTests();
    fake.prompts = [];
    fake.result = () => Promise.resolve({ data: Buffer.from("fake-png"), contentType: "image/png" });
  });

  afterEach(() => setImageGenerationProviderForTests(undefined));

  it("returns the generated image as a data: URL, from a prompt built from the build (AC-1)", async () => {
    const res = await render(build);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ imageUrl: `data:image/png;base64,${Buffer.from("fake-png").toString("base64")}`, isPlaceholder: false });
    expect(fake.prompts).toHaveLength(1);
    expect(fake.prompts[0]).toContain("Apex GT");
    expect(fake.prompts[0]).toContain("more extreme");
  });

  it("describes a custom paint by its color, and only allows it with the Custom Color paint", async () => {
    const custom = { ...build, singleSelections: { ...build.singleSelections, PAINT: customPaintId }, customPaintHex: "#1f4b8f" };
    expect((await render(custom)).status).toBe(200);
    expect(fake.prompts[0]).toContain("#1f4b8f");

    const res = await render({ ...build, customPaintHex: "#1f4b8f" });
    expect(res.status).toBe(400);
    expect(res.body.details.customPaintHex).toBeDefined();
    expect(fake.prompts).toHaveLength(1); // the invalid one never reached the provider
  });

  it("validates the build like a save — nothing invalid reaches the (paid) provider", async () => {
    expect((await render({ ...build, customPaintHex: "red" })).status).toBe(400);
    expect((await render({ ...build, vehicleSlug: "nope" })).status).toBe(404);
    nextDay();
    const mismatch = await render({ ...build, singleSelections: { ...build.singleSelections, WHEELS: rsWheelsId } });
    expect(mismatch.status).toBe(422);
    expect(mismatch.body.code).toBe("OPTION_VEHICLE_MISMATCH");
    expect((await render({})).status).toBe(400);
    expect(fake.prompts).toEqual([]);
  });

  it("a provider failure is a 502 with a friendly message, never the vendor's detail (AC-4)", async () => {
    fake.result = () => Promise.reject(new Error("vendor said: invalid key sk-123"));
    const res = await render(build);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ code: "IMAGE_PROVIDER_ERROR", message: "Couldn't generate a concept right now. Try again." });
  });

  it("is off unless enabled — and a request while off doesn't count against anyone", async () => {
    delete process.env.CONCEPT_RENDERS_ENABLED;
    for (let i = 0; i < 3; i++) {
      const res = await render(build);
      expect(res.status).toBe(503);
      expect(res.body.code).toBe("CONCEPT_RENDERS_DISABLED");
    }
    process.env.CONCEPT_RENDERS_ENABLED = "true";
    expect((await render(build)).status).toBe(200); // the 3 refused ones used none of the allowance
  });

  it("is off when no provider is configured, even with the flag on", async () => {
    setImageGenerationProviderForTests(null);
    const res = await render(build);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("CONCEPT_RENDERS_DISABLED");
  });

  it("allows 2 a minute per visitor (AC-5)", async () => {
    expect((await render(build)).status).toBe(200);
    expect((await render(build)).status).toBe(200);
    const res = await render(build);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("RATE_LIMITED");
    vi.setSystemTime(clock + 61_000);
    expect((await render(build)).status).toBe(200);
  });

  it("allows 10 a day per visitor (Risk #2)", async () => {
    for (let i = 0; i < 10; i++) {
      vi.setSystemTime(clock + i * 61_000); // spaced out, past the per-minute limit
      expect((await render(build)).status).toBe(200);
    }
    vi.setSystemTime(clock + 11 * 61_000);
    const res = await render(build);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("CONCEPT_RENDER_DAILY_LIMIT");
  });

  it(`stops at ${GLOBAL_DAILY_LIMIT} a day across the whole site (Risk #2)`, async () => {
    const { takeDailySlot } = await import("../../src/services/imageGeneration/index.js");
    for (let i = 0; i < GLOBAL_DAILY_LIMIT; i++) takeDailySlot(); // other visitors used today's allowance
    const res = await render(build);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("CONCEPT_RENDER_DAILY_LIMIT");
    expect(fake.prompts).toEqual([]);
  });

  it("works end to end with the development placeholder", async () => {
    setImageGenerationProviderForTests(undefined);
    process.env.IMAGE_PROVIDER = "placeholder";
    try {
      const res = await render(build);
      expect(res.status).toBe(200);
      expect(res.body.data.isPlaceholder).toBe(true);
      expect(res.body.data.imageUrl).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(Buffer.from(res.body.data.imageUrl.split(",")[1], "base64").toString("utf8")).toContain("DEVELOPMENT PLACEHOLDER");
    } finally {
      delete process.env.IMAGE_PROVIDER;
    }
  });
});
