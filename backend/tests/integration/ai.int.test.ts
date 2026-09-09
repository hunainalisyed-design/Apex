import "dotenv/config";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const createConfigureMessageMock = vi.fn();
vi.mock("../../src/services/ai/claudeClient.js", () => ({
  createConfigureMessage: (...args: unknown[]) => createConfigureMessageMock(...args),
  AI_MODEL: "claude-opus-5",
}));

// Rate limiting (Spec 14 Risk #2) isn't what these tests exercise, and its intentionally
// tight window (1 request per 5s) would otherwise throttle this file's own rapid-fire test
// requests against each other — bypass it here rather than testing it, same as any other
// cross-cutting concern these tests aren't about.
vi.mock("../../src/middleware/rateLimit.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/middleware/rateLimit.js")>();
  return {
    ...actual,
    aiRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/lib/prisma.js");
const { seedDatabase } = await import("../../prisma/seed.js");
const { CONFIGURE_TOOL_NAME } = await import("../../src/services/ai/buildToolSchema.js");
const { ALL_CATEGORIES, SINGLE_SELECT_CATEGORIES } = await import("../../src/types/catalog.js");

function mockToolUseMessage(input: Record<string, unknown>) {
  return {
    id: "msg_mock",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    stop_reason: "tool_use",
    stop_sequence: null,
    content: [{ type: "tool_use", id: "toolu_mock", name: CONFIGURE_TOOL_NAME, input }],
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

/** Every category present and null — the "no change on anything" shape the real tool
 * schema always requires, per-test overrides layer on top. */
function baseToolInput(overrides: Record<string, unknown> = {}) {
  const input: Record<string, unknown> = { assistantMessage: "Here's a suggestion." };
  for (const category of ALL_CATEGORIES) input[category] = null;
  return { ...input, ...overrides };
}

async function defaultSelectionsFor(vehicleSlug: string) {
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { slug: vehicleSlug } });
  const options = await prisma.customizationOption.findMany({ where: { vehicleId: vehicle.id } });

  const singleSelections: Record<string, string> = {};
  for (const category of SINGLE_SELECT_CATEGORIES) {
    const option = options.find((o) => o.category === category && o.isDefault);
    singleSelections[category] = option!.id;
  }

  return { vehicle, options, singleSelections };
}

describe("POST /api/ai/configure (integration, Spec 14)", () => {
  let gt: Awaited<ReturnType<typeof defaultSelectionsFor>>;

  beforeAll(async () => {
    await seedDatabase(prisma);
    gt = await defaultSelectionsFor("apex-gt");
  }, 30000);

  afterEach(() => {
    createConfigureMessageMock.mockReset();
    delete process.env.AI_ASSISTANT_ENABLED;
  });

  function requestBody(overrides: Record<string, unknown> = {}) {
    return {
      vehicleSlug: "apex-gt",
      message: "Make it more aggressive.",
      currentSelections: {
        singleSelections: gt.singleSelections,
        multiSelections: { ACCESSORY: [], PACKAGE: [] },
      },
      ...overrides,
    };
  }

  it("returns a validated recommendation with a server-computed price, never trusting the model's own total (AC-1, AC-2, AC-3)", async () => {
    const wheelsAlt = gt.options.find((o) => o.category === "WHEELS" && !o.isDefault)!;
    createConfigureMessageMock.mockResolvedValueOnce(
      mockToolUseMessage(baseToolInput({ WHEELS: wheelsAlt.id, assistantMessage: "Swapped to sportier wheels." })),
    );

    const res = await request(createApp()).post("/api/ai/configure").send(requestBody());

    expect(res.status).toBe(200);
    expect(res.body.data.assistantMessage).toBe("Swapped to sportier wheels.");
    expect(res.body.data.recommendation.singleSelections.WHEELS).toBe(wheelsAlt.id);
    expect(res.body.data.breakdown.totalPriceCents).toBe(gt.vehicle.basePriceCents + wheelsAlt.priceDeltaCents);
  });

  it("returns recommendation: null and breakdown: null when the model indicates no change is warranted (AC-4)", async () => {
    createConfigureMessageMock.mockResolvedValueOnce(
      mockToolUseMessage(baseToolInput({ assistantMessage: "I'm CarAI — ask me to change your build!" })),
    );

    const res = await request(createApp()).post("/api/ai/configure").send(requestBody({ message: "hello" }));

    expect(res.status).toBe(200);
    expect(res.body.data.recommendation).toBeNull();
    expect(res.body.data.breakdown).toBeNull();
  });

  it("threads currentSelections into the prompt so a relative command resolves against the current build, not defaults (AC-5)", async () => {
    createConfigureMessageMock.mockResolvedValueOnce(mockToolUseMessage(baseToolInput()));

    await request(createApp()).post("/api/ai/configure").send(requestBody());

    const [[callArgs]] = createConfigureMessageMock.mock.calls;
    const contextMessage = callArgs.messages[0].content as string;
    expect(contextMessage).toContain("Current selections:");
    // The default PAINT option's name should appear, resolved from its id.
    const paintOption = gt.options.find((o) => o.id === gt.singleSelections.PAINT)!;
    expect(contextMessage).toContain(paintOption.name);
  });

  it("silently drops a recommended option id that doesn't exist, still pricing correctly from what survives (AC-2, AC-9 adversarial input)", async () => {
    createConfigureMessageMock.mockResolvedValueOnce(
      mockToolUseMessage(baseToolInput({ PAINT: "totally-made-up-option-id" })),
    );

    const res = await request(createApp()).post("/api/ai/configure").send(requestBody());

    expect(res.status).toBe(200);
    // Nothing valid survived validation, so this collapses to "no recommendation" — never
    // a broken/partial recommendation or a price built from an option that doesn't exist.
    expect(res.body.data.recommendation).toBeNull();
    expect(res.body.data.breakdown).toBeNull();
  });

  it("returns 502 AI_PROVIDER_ERROR when the Claude API call fails, without leaking the raw error", async () => {
    createConfigureMessageMock.mockRejectedValueOnce(new Error("connection reset"));

    const res = await request(createApp()).post("/api/ai/configure").send(requestBody());

    expect(res.status).toBe(502);
    expect(res.body.code).toBe("AI_PROVIDER_ERROR");
    expect(res.body.message).not.toContain("connection reset");
  });

  it("returns 502 AI_PROVIDER_ERROR when the response has no usable tool_use block", async () => {
    createConfigureMessageMock.mockResolvedValueOnce({
      id: "msg_mock",
      type: "message",
      role: "assistant",
      model: "claude-opus-5",
      stop_reason: "end_turn",
      stop_sequence: null,
      content: [{ type: "text", text: "I refuse to use the tool." }],
      usage: { input_tokens: 10, output_tokens: 10 },
    });

    const res = await request(createApp()).post("/api/ai/configure").send(requestBody());

    expect(res.status).toBe(502);
    expect(res.body.code).toBe("AI_PROVIDER_ERROR");
  });

  it("returns 404 VEHICLE_NOT_FOUND for an unknown vehicle, never calling Claude", async () => {
    const res = await request(createApp()).post("/api/ai/configure").send(requestBody({ vehicleSlug: "does-not-exist" }));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VEHICLE_NOT_FOUND");
    expect(createConfigureMessageMock).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_ERROR for a malformed history whose first entry isn't role \"user\", never calling Claude", async () => {
    const res = await request(createApp())
      .post("/api/ai/configure")
      .send(requestBody({ history: [{ role: "assistant", content: "hi" }] }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(createConfigureMessageMock).not.toHaveBeenCalled();
  });

  it("returns 503 AI_ASSISTANT_DISABLED when the feature flag is off, never calling Claude", async () => {
    process.env.AI_ASSISTANT_ENABLED = "false";

    const res = await request(createApp()).post("/api/ai/configure").send(requestBody());

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("AI_ASSISTANT_DISABLED");
    expect(createConfigureMessageMock).not.toHaveBeenCalled();
  });

  it("never lets ANTHROPIC_API_KEY reach the response body under any failure (AC-8)", async () => {
    createConfigureMessageMock.mockRejectedValueOnce(new Error(`auth failed for key ${process.env.ANTHROPIC_API_KEY}`));

    const res = await request(createApp()).post("/api/ai/configure").send(requestBody());

    expect(JSON.stringify(res.body)).not.toContain("auth failed for key");
  });
});
