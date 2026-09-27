import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({ prisma: {} }));

const {
  applyChange,
  EMPTY_SESSION_GRACE_MS,
  INACTIVITY_TIMEOUT_MS,
  isSessionId,
  LiveSessionRegistry,
  MAX_PARTICIPANTS,
  MAX_SESSIONS,
  normalizeDisplayName,
  PARTICIPANT_COLORS,
  validateState,
} = await import("../src/services/liveSession/registry.js");
const { parseClientMessage } = await import("../src/ws/liveSession.js");
const { SINGLE_SELECT_CATEGORIES } = await import("../src/types/catalog.js");

import type { LiveCatalog } from "../src/services/liveSession/registry.js";
import type { LiveSelectionState, LiveStateDto } from "../src/types/liveSession.js";
import type { OptionCategory } from "../src/types/catalog.js";

// Two options per single-select category ("<CATEGORY>-a" default, "<CATEGORY>-b"), plus a custom
// paint, two accessories and a package.
const categoryByOptionId = new Map<string, OptionCategory>();
for (const category of SINGLE_SELECT_CATEGORIES) {
  categoryByOptionId.set(`${category}-a`, category);
  categoryByOptionId.set(`${category}-b`, category);
}
categoryByOptionId.set("PAINT-custom", "PAINT");
categoryByOptionId.set("ACC-1", "ACCESSORY");
categoryByOptionId.set("ACC-2", "ACCESSORY");
categoryByOptionId.set("PKG-1", "PACKAGE");

const catalog: LiveCatalog = { categoryByOptionId, customPaintOptionId: "PAINT-custom", environmentIds: new Set(["env-sunset"]) };

function initial(): LiveSelectionState {
  return {
    singleSelections: Object.fromEntries(SINGLE_SELECT_CATEGORIES.map((c) => [c, `${c}-a`])) as LiveSelectionState["singleSelections"],
    multiSelections: { ACCESSORY: [], PACKAGE: [] },
    customPaintHex: null,
    environmentId: null,
  };
}

function state(): LiveStateDto {
  return { ...initial(), version: 0 };
}

describe("applyChange — conflict resolution (Spec 33, AC-3/AC-4)", () => {
  it("single-select categories are last-write-wins: the later change is what everyone gets", () => {
    const s = state();
    expect(applyChange(s, { kind: "select", category: "WHEELS", optionId: "WHEELS-b" }, catalog)).toEqual({ ok: true });
    expect(applyChange(s, { kind: "select", category: "WHEELS", optionId: "WHEELS-a" }, catalog)).toEqual({ ok: true });
    expect(s.singleSelections.WHEELS).toBe("WHEELS-a");
    expect(s.version).toBe(2);
  });

  it("changes to different categories never overwrite each other", () => {
    const s = state();
    applyChange(s, { kind: "select", category: "WHEELS", optionId: "WHEELS-b" }, catalog);
    applyChange(s, { kind: "select", category: "PAINT", optionId: "PAINT-b" }, catalog);
    expect(s.singleSelections.WHEELS).toBe("WHEELS-b");
    expect(s.singleSelections.PAINT).toBe("PAINT-b");
  });

  it("accessories are toggles, so two people adding different ones at once both stick", () => {
    const s = state();
    applyChange(s, { kind: "toggle", category: "ACCESSORY", optionId: "ACC-1" }, catalog);
    applyChange(s, { kind: "toggle", category: "ACCESSORY", optionId: "ACC-2" }, catalog);
    expect(s.multiSelections.ACCESSORY).toEqual(["ACC-1", "ACC-2"]);
    applyChange(s, { kind: "toggle", category: "ACCESSORY", optionId: "ACC-1" }, catalog);
    expect(s.multiSelections.ACCESSORY).toEqual(["ACC-2"]);
  });

  it("rejects options from another category or vehicle, leaving the state untouched", () => {
    const s = state();
    expect(applyChange(s, { kind: "select", category: "WHEELS", optionId: "PAINT-b" }, catalog)).toMatchObject({
      ok: false,
      code: "OPTION_VEHICLE_MISMATCH",
    });
    expect(applyChange(s, { kind: "select", category: "WHEELS", optionId: "nope" }, catalog)).toMatchObject({ ok: false });
    expect(applyChange(s, { kind: "toggle", category: "PACKAGE", optionId: "ACC-1" }, catalog)).toMatchObject({ ok: false });
    expect(s).toEqual(state());
  });

  it("custom paint: needs the Custom Color paint and a #rrggbb color; picking a paint clears it", () => {
    const s = state();
    expect(applyChange(s, { kind: "customPaint", hex: "#112233" }, catalog)).toMatchObject({ ok: false });
    applyChange(s, { kind: "select", category: "PAINT", optionId: "PAINT-custom" }, catalog);
    expect(applyChange(s, { kind: "customPaint", hex: "red" }, catalog)).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(applyChange(s, { kind: "customPaint", hex: "#AABBCC" }, catalog)).toEqual({ ok: true });
    expect(s.customPaintHex).toBe("#aabbcc");
    applyChange(s, { kind: "select", category: "PAINT", optionId: "PAINT-custom" }, catalog);
    expect(s.customPaintHex).toBeNull();
  });

  it("environment: a known scene or null (Studio)", () => {
    const s = state();
    expect(applyChange(s, { kind: "environment", environmentId: "env-sunset" }, catalog)).toEqual({ ok: true });
    expect(applyChange(s, { kind: "environment", environmentId: "env-mars" }, catalog)).toMatchObject({ ok: false });
    expect(applyChange(s, { kind: "environment", environmentId: null }, catalog)).toEqual({ ok: true });
    expect(s.environmentId).toBeNull();
  });
});

describe("validateState — the creator's starting build", () => {
  it("accepts a complete, valid build", () => {
    expect(validateState(initial(), catalog)).toEqual({ ok: true });
  });

  it("rejects a missing category, a foreign option, duplicates, a bad hex, or an unknown scene", () => {
    const missing = initial();
    delete (missing.singleSelections as Partial<LiveSelectionState["singleSelections"]>).WHEELS;
    expect(validateState(missing, catalog)).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(validateState({ ...initial(), singleSelections: { ...initial().singleSelections, WHEELS: "PAINT-a" } }, catalog)).toMatchObject({
      ok: false,
      code: "OPTION_VEHICLE_MISMATCH",
    });
    expect(validateState({ ...initial(), multiSelections: { ACCESSORY: ["ACC-1", "ACC-1"], PACKAGE: [] } }, catalog)).toMatchObject({ ok: false });
    expect(validateState({ ...initial(), customPaintHex: "#123456" }, catalog)).toMatchObject({ ok: false }); // not the custom paint
    expect(validateState({ ...initial(), environmentId: "env-mars" }, catalog)).toMatchObject({ ok: false });
  });
});

describe("LiveSessionRegistry", () => {
  it("creates sessions with unguessable 16-character ids", () => {
    const registry = new LiveSessionRegistry();
    const a = registry.create("apex-gt", catalog, initial(), 0)!;
    const b = registry.create("apex-gt", catalog, initial(), 0)!;
    expect(isSessionId(a.id)).toBe(true);
    expect(a.id).not.toBe(b.id);
    expect(isSessionId("short")).toBe(false);
  });

  it("refuses new sessions past the memory cap, and has room again once one closes", () => {
    const registry = new LiveSessionRegistry();
    const sessions = Array.from({ length: MAX_SESSIONS }, () => registry.create("apex-gt", catalog, initial(), 0));
    expect(sessions.every(Boolean)).toBe(true);
    expect(registry.create("apex-gt", catalog, initial(), 0)).toBeNull();
    registry.close(sessions[0]!.id);
    expect(registry.create("apex-gt", catalog, initial(), 0)).not.toBeNull();
  });

  it("gives each participant a distinct color, and refuses past the cap", () => {
    const registry = new LiveSessionRegistry();
    const session = registry.create("apex-gt", catalog, initial(), 0)!;
    const people = Array.from({ length: MAX_PARTICIPANTS }, (_, i) => registry.join(session, `P${i}`, undefined, 0)!);
    expect(new Set(people.map((p) => p.color)).size).toBe(MAX_PARTICIPANTS);
    expect(people.every((p) => (PARTICIPANT_COLORS as readonly string[]).includes(p.color))).toBe(true);
    expect(registry.join(session, "One too many", undefined, 0)).toBeNull();

    registry.disconnect(session, people[0].id, 0);
    expect(registry.join(session, "Now fits", undefined, 0)).not.toBeNull();
  });

  it("a reconnect with the token keeps the same identity and color, even when otherwise full", () => {
    const registry = new LiveSessionRegistry();
    const session = registry.create("apex-gt", catalog, initial(), 0)!;
    const alex = registry.join(session, "Alex", undefined, 0)!;
    registry.disconnect(session, alex.id, 1);
    expect(registry.participantsOf(session)).toEqual([]);
    for (let i = 1; i < MAX_PARTICIPANTS; i++) registry.join(session, `P${i}`, undefined, 2);

    const back = registry.join(session, "Alex", alex.token, 3)!;
    expect(back.id).toBe(alex.id);
    expect(back.color).toBe(alex.color);
    expect(registry.participantsOf(session)).toHaveLength(MAX_PARTICIPANTS);
  });

  it("closes a session after 30 minutes without activity (AC-6)", () => {
    const registry = new LiveSessionRegistry();
    const session = registry.create("apex-gt", catalog, initial(), 0)!;
    registry.join(session, "Alex", undefined, 0);
    expect(registry.sweep(INACTIVITY_TIMEOUT_MS - 1)).toEqual([]);
    registry.touch(session, INACTIVITY_TIMEOUT_MS - 1);
    expect(registry.sweep(INACTIVITY_TIMEOUT_MS + 1)).toEqual([]); // activity reset the clock
    expect(registry.sweep(2 * INACTIVITY_TIMEOUT_MS)).toEqual([session]);
    expect(registry.get(session.id)).toBeUndefined();
  });

  it("closes a session nobody is connected to after the grace period", () => {
    const registry = new LiveSessionRegistry();
    const never = registry.create("apex-gt", catalog, initial(), 0)!;
    const left = registry.create("apex-gt", catalog, initial(), 0)!;
    const alex = registry.join(left, "Alex", undefined, 0)!;
    registry.disconnect(left, alex.id, 60_000);

    expect(registry.sweep(EMPTY_SESSION_GRACE_MS).map((s) => s.id)).toEqual([never.id]);
    expect(registry.sweep(60_000 + EMPTY_SESSION_GRACE_MS).map((s) => s.id)).toEqual([left.id]);
  });
});

describe("display names and message parsing", () => {
  it("normalizes names: trimmed, no control characters, capped, never empty", () => {
    expect(normalizeDisplayName("  Alex  ")).toBe("Alex");
    expect(normalizeDisplayName("A\u0000l\u0007ex")).toBe("Alex");
    expect(normalizeDisplayName("x".repeat(100))).toHaveLength(24);
    expect(normalizeDisplayName("   ")).toBe("Guest");
    expect(normalizeDisplayName(42)).toBe("Guest");
  });

  it("accepts only well-formed messages", () => {
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "hack" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "cursor", position: [1, 2] }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "cursor", position: [1, 2, Infinity] }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "cursor", position: [1, 2, 3] }))).toEqual({ type: "cursor", position: [1, 2, 3] });
    expect(parseClientMessage(JSON.stringify({ type: "cursor", position: null }))).toEqual({ type: "cursor", position: null });
    expect(parseClientMessage(JSON.stringify({ type: "change", change: { kind: "select", category: "ACCESSORY", optionId: "x" } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "change", change: { kind: "toggle", category: "ACCESSORY", optionId: "x" } }))).toEqual({
      type: "change",
      change: { kind: "toggle", category: "ACCESSORY", optionId: "x" },
    });
    expect(parseClientMessage(JSON.stringify({ type: "join", displayName: " Sam " }))).toEqual({
      type: "join",
      displayName: "Sam",
      participantToken: undefined,
    });
    expect(parseClientMessage(JSON.stringify({ type: "saved", publicId: "has space" }))).toBeNull();
  });
});
