import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { diffSelections } from "../../src/lib/live/diffSelections";
import { useConfigurationStore } from "../../src/state/configurationStore";
import { useLiveSessionStore } from "../../src/state/liveSessionStore";
import { SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog";
import type { LiveSelectionState, LiveServerMessage, LiveStateDto } from "../../src/types/liveSession";

/** A stand-in for the browser WebSocket that lets the test play the server. */
class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  // test helpers
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(message: LiveServerMessage) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  changes() {
    return this.sent.filter((m) => (m as { type: string }).type === "change").map((m) => (m as { change: unknown }).change);
  }
}

function selections(overrides: Partial<Record<string, string>> = {}): LiveSelectionState {
  return {
    singleSelections: Object.fromEntries(SINGLE_SELECT_CATEGORIES.map((c) => [c, overrides[c] ?? `${c}-a`])) as LiveSelectionState["singleSelections"],
    multiSelections: { ACCESSORY: [], PACKAGE: [] },
    customPaintHex: null,
    environmentId: null,
  };
}

function serverState(version: number, overrides: Partial<Record<string, string>> = {}): LiveStateDto {
  return { ...selections(overrides), version };
}

const PARTICIPANTS = [
  { id: "me", displayName: "Alex", color: "#60a5fa" },
  { id: "sam", displayName: "Sam", color: "#f472b6" },
];

function joinAs(socket: FakeSocket, state = serverState(0)) {
  socket.open();
  socket.receive({ type: "welcome", participantId: "me", participantToken: "tok", state, participants: PARTICIPANTS });
}

describe("diffSelections (Spec 33)", () => {
  it("turns a store change into live-session changes", () => {
    const prev = selections();
    const next: LiveSelectionState = {
      ...selections({ WHEELS: "WHEELS-b" }),
      multiSelections: { ACCESSORY: ["acc-2"], PACKAGE: [] },
      environmentId: "env-sunset",
    };
    prev.multiSelections = { ACCESSORY: ["acc-1"], PACKAGE: [] };
    expect(diffSelections(prev, next)).toEqual([
      { kind: "select", category: "WHEELS", optionId: "WHEELS-b" },
      { kind: "toggle", category: "ACCESSORY", optionId: "acc-2" },
      { kind: "toggle", category: "ACCESSORY", optionId: "acc-1" },
      { kind: "environment", environmentId: "env-sunset" },
    ]);
  });

  it("sends a new custom color, but not its clearing (picking a paint clears it on both sides)", () => {
    const withHex = { ...selections({ PAINT: "PAINT-custom" }), customPaintHex: "#112233" };
    expect(diffSelections(selections({ PAINT: "PAINT-custom" }), withHex)).toEqual([{ kind: "customPaint", hex: "#112233" }]);
    expect(diffSelections(withHex, selections({ PAINT: "PAINT-b" }))).toEqual([{ kind: "select", category: "PAINT", optionId: "PAINT-b" }]);
  });

  it("nothing changed → nothing to send", () => {
    expect(diffSelections(selections(), selections())).toEqual([]);
  });
});

describe("liveSessionStore (Spec 33)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeSocket);
    useConfigurationStore.setState({ ...selections(), savedConfiguration: null });
  });

  afterEach(() => {
    useLiveSessionStore.getState().leave();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("joins with the chosen name, then takes the session's state (AC-2)", () => {
    useLiveSessionStore.getState().connect("SESSION1234567890", "Alex");
    const socket = FakeSocket.instances[0];
    expect(socket.url).toMatch(/\/ws\/live-sessions\/SESSION1234567890$/);
    expect(useLiveSessionStore.getState().status).toBe("connecting");

    joinAs(socket, serverState(3, { WHEELS: "WHEELS-b" }));
    expect(socket.sent[0]).toEqual({ type: "join", displayName: "Alex" });
    expect(useLiveSessionStore.getState()).toMatchObject({ status: "connected", participantId: "me", participants: PARTICIPANTS });
    expect(useConfigurationStore.getState().singleSelections.WHEELS).toBe("WHEELS-b");
    expect(sessionStorage.getItem("apex-live-token:SESSION1234567890")).toBe("tok");
  });

  it("sends the local user's changes — and never echoes the server's back (AC-3)", () => {
    useLiveSessionStore.getState().connect("SESSION1234567890", "Alex");
    const socket = FakeSocket.instances[0];
    joinAs(socket);

    useConfigurationStore.getState().setSingleSelection("WHEELS", "WHEELS-b");
    useConfigurationStore.getState().toggleMultiSelection("ACCESSORY", "acc-1");
    expect(socket.changes()).toEqual([
      { kind: "select", category: "WHEELS", optionId: "WHEELS-b" },
      { kind: "toggle", category: "ACCESSORY", optionId: "acc-1" },
    ]);

    socket.receive({
      type: "state",
      state: serverState(3, { PAINT: "PAINT-b", WHEELS: "WHEELS-b" }),
      change: { participantId: "sam", displayName: "Sam", change: { kind: "select", category: "PAINT", optionId: "PAINT-b" } },
    });
    expect(useConfigurationStore.getState().singleSelections.PAINT).toBe("PAINT-b");
    expect(socket.changes()).toHaveLength(2); // the remote change wasn't sent back
    expect(useLiveSessionStore.getState().lastRemoteChange).toMatchObject({ displayName: "Sam", change: { category: "PAINT" } });
  });

  it("doesn't announce your own change as a remote one", () => {
    useLiveSessionStore.getState().connect("SESSION1234567890", "Alex");
    const socket = FakeSocket.instances[0];
    joinAs(socket);
    socket.receive({
      type: "state",
      state: serverState(1, { WHEELS: "WHEELS-b" }),
      change: { participantId: "me", displayName: "Alex", change: { kind: "select", category: "WHEELS", optionId: "WHEELS-b" } },
    });
    expect(useLiveSessionStore.getState().lastRemoteChange).toBeNull();
  });

  it("holds others' changes while a capture runs, then applies the latest", () => {
    useLiveSessionStore.getState().connect("SESSION1234567890", "Alex");
    const socket = FakeSocket.instances[0];
    joinAs(socket);

    useLiveSessionStore.getState().setHoldRemote(true);
    socket.receive({ type: "state", state: serverState(1, { WHEELS: "WHEELS-b" }), change: null });
    socket.receive({ type: "state", state: serverState(2, { WHEELS: "WHEELS-c" }), change: null });
    expect(useConfigurationStore.getState().singleSelections.WHEELS).toBe("WHEELS-a");

    useLiveSessionStore.getState().setHoldRemote(false);
    expect(useConfigurationStore.getState().singleSelections.WHEELS).toBe("WHEELS-c");
    expect(socket.changes()).toEqual([]);
  });

  it("tracks others' cursors and drops them when they leave (AC-7)", () => {
    useLiveSessionStore.getState().connect("SESSION1234567890", "Alex");
    const socket = FakeSocket.instances[0];
    joinAs(socket);
    socket.receive({ type: "cursor", participantId: "sam", position: [1, 2, 3] });
    expect(useLiveSessionStore.getState().cursors).toEqual({ sam: [1, 2, 3] });
    socket.receive({ type: "presence", participants: [PARTICIPANTS[0]] });
    expect(useLiveSessionStore.getState().cursors).toEqual({});
  });

  it("throttles cursor moves but sends 'off the car' at once", () => {
    useLiveSessionStore.getState().connect("SESSION1234567890", "Alex");
    const socket = FakeSocket.instances[0];
    joinAs(socket);
    const cursors = () => socket.sent.filter((m) => (m as { type: string }).type === "cursor");

    const { sendCursor } = useLiveSessionStore.getState();
    sendCursor([0, 0, 1]);
    sendCursor([0, 0, 2]);
    sendCursor([0, 0, 3]);
    expect(cursors()).toEqual([{ type: "cursor", position: [0, 0, 1] }]);
    vi.advanceTimersByTime(60);
    expect(cursors()).toEqual([
      { type: "cursor", position: [0, 0, 1] },
      { type: "cursor", position: [0, 0, 3] },
    ]);
    sendCursor(null);
    expect(cursors().at(-1)).toEqual({ type: "cursor", position: null });
  });

  it("announces a new save to the partner (AC-5, the session carries on)", () => {
    useLiveSessionStore.getState().connect("SESSION1234567890", "Alex");
    const socket = FakeSocket.instances[0];
    joinAs(socket);
    useConfigurationStore.setState({ savedConfiguration: { publicId: "APEX-SAVE-0001" } as never });
    expect(socket.sent.at(-1)).toEqual({ type: "saved", publicId: "APEX-SAVE-0001" });
    expect(useLiveSessionStore.getState().status).toBe("connected");

    socket.receive({ type: "saved", participantId: "sam", displayName: "Sam", publicId: "APEX-SAVE-0002" });
    expect(useLiveSessionStore.getState().lastSaved).toEqual({ displayName: "Sam", publicId: "APEX-SAVE-0002" });
  });

  it("reconnects after a network drop, rejoining with its token", () => {
    useLiveSessionStore.getState().connect("SESSION1234567890", "Alex");
    joinAs(FakeSocket.instances[0]);
    FakeSocket.instances[0].drop(1006);
    expect(useLiveSessionStore.getState().status).toBe("reconnecting");

    vi.advanceTimersByTime(1000);
    const again = FakeSocket.instances[1];
    again.open();
    expect(again.sent[0]).toEqual({ type: "join", displayName: "Alex", participantToken: "tok" });
    again.receive({ type: "welcome", participantId: "me", participantToken: "tok", state: serverState(5), participants: PARTICIPANTS });
    expect(useLiveSessionStore.getState().status).toBe("connected");
  });

  it.each([
    [4404, "notFound"],
    [4410, "expired"],
    [4409, "full"],
    [4503, "disabled"],
    [4411, "replaced"],
    [1009, "failed"],
  ])("ends for good on close code %i (%s), without retrying", (code, reason) => {
    useLiveSessionStore.getState().connect("SESSION1234567890", "Alex");
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].drop(code);
    expect(useLiveSessionStore.getState()).toMatchObject({ status: "ended", endReason: reason });
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("stops sending once it's left", () => {
    useLiveSessionStore.getState().connect("SESSION1234567890", "Alex");
    const socket = FakeSocket.instances[0];
    joinAs(socket);
    useLiveSessionStore.getState().leave();
    useConfigurationStore.getState().setSingleSelection("WHEELS", "WHEELS-b");
    expect(socket.changes()).toEqual([]);
    expect(useLiveSessionStore.getState().status).toBe("idle");
  });
});
