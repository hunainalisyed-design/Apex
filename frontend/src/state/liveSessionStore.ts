import { create } from "zustand";
import { diffSelections } from "@/lib/live/diffSelections";
import { liveSessionSocketUrl } from "@/lib/api/liveSessions";
import { useConfigurationStore, type ConfigurationState } from "@/state/configurationStore";
import type {
  LiveChange,
  LiveClientMessage,
  LiveCursorPosition,
  LiveParticipantDto,
  LiveSelectionState,
  LiveServerMessage,
  LiveStateDto,
} from "@/types/liveSession";

export type LiveStatus = "idle" | "connecting" | "connected" | "reconnecting" | "ended";
export type LiveEndReason = "notFound" | "expired" | "full" | "disabled" | "replaced" | "failed" | "left";

/** Close codes the server uses (backend/src/ws/liveSession.ts CLOSE). */
const END_REASON_BY_CODE: Record<number, LiveEndReason> = {
  4404: "notFound",
  4410: "expired",
  4409: "full",
  4503: "disabled",
  4411: "replaced",
  4400: "failed",
  4429: "failed",
  // "Message too big" — retrying the same connection can't help.
  1009: "failed",
};
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 10000];
const MAX_RECONNECT_ATTEMPTS = 12; // ~1.5 minutes of retrying before giving up
const CURSOR_INTERVAL_MS = 50;

export interface LiveRemoteChange {
  participantId: string;
  displayName: string;
  change: LiveChange;
  /** Distinguishes two identical changes in a row, so each one is announced. */
  seq: number;
}

export interface LiveSessionState {
  sessionId: string | null;
  status: LiveStatus;
  endReason: LiveEndReason | null;
  participantId: string | null;
  participants: LiveParticipantDto[];
  /** Other participants' pointers on the car, by participant id. */
  cursors: Record<string, [number, number, number]>;
  lastRemoteChange: LiveRemoteChange | null;
  lastSaved: { displayName: string; publicId: string } | null;
  connect: (sessionId: string, displayName: string) => void;
  leave: () => void;
  sendCursor: (position: LiveCursorPosition) => void;
  /** While a capture runs, others' changes wait, so they can't change the scene mid-capture. */
  setHoldRemote: (hold: boolean) => void;
}

// --- Connection state that isn't UI state ------------------------------------------------

let socket: WebSocket | null = null;
let displayNameInUse = "Guest";
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let unsubscribeConfig: (() => void) | null = null;
let unsubscribeSaved: (() => void) | null = null;
/** True while applying the server's state to the store — those store changes aren't sent back. */
let applyingRemote = false;
let holdRemote = false;
let heldState: LiveStateDto | null = null;
let changeSeq = 0;
let lastCursorSentAt = 0;
let pendingCursor: LiveCursorPosition | undefined;
let cursorTimer: ReturnType<typeof setTimeout> | null = null;

function tokenKey(sessionId: string) {
  return `apex-live-token:${sessionId}`;
}

function readToken(sessionId: string): string | undefined {
  try {
    return sessionStorage.getItem(tokenKey(sessionId)) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeToken(sessionId: string, token: string) {
  try {
    sessionStorage.setItem(tokenKey(sessionId), token);
  } catch {
    // Without storage a reconnect just joins as a new participant.
  }
}

function selectionSlice(state: Pick<ConfigurationState, keyof LiveSelectionState>): LiveSelectionState {
  return {
    singleSelections: state.singleSelections,
    multiSelections: state.multiSelections,
    customPaintHex: state.customPaintHex,
    environmentId: state.environmentId,
  };
}

function send(message: LiveClientMessage) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function applyRemoteState(state: LiveStateDto) {
  if (holdRemote) {
    heldState = state;
    return;
  }
  applyingRemote = true;
  try {
    useConfigurationStore.setState({
      singleSelections: state.singleSelections,
      multiSelections: state.multiSelections,
      customPaintHex: state.customPaintHex,
      environmentId: state.environmentId,
    });
  } finally {
    applyingRemote = false;
  }
}

function stopSync() {
  unsubscribeConfig?.();
  unsubscribeSaved?.();
  unsubscribeConfig = null;
  unsubscribeSaved = null;
}

/** Local edits → the session; a new save → announced to the others (the session carries on). */
function startSync() {
  stopSync();
  unsubscribeConfig = useConfigurationStore.subscribe((next, prev) => {
    if (applyingRemote || useLiveSessionStore.getState().status !== "connected") return;
    for (const change of diffSelections(selectionSlice(prev), selectionSlice(next))) send({ type: "change", change });
  });
  unsubscribeSaved = useConfigurationStore.subscribe((next, prev) => {
    const publicId = next.savedConfiguration?.publicId;
    if (publicId && publicId !== prev.savedConfiguration?.publicId) send({ type: "saved", publicId });
  });
}

function clearTimers() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (cursorTimer) clearTimeout(cursorTimer);
  reconnectTimer = null;
  cursorTimer = null;
}

export const useLiveSessionStore = create<LiveSessionState>((set, get) => {
  function open(sessionId: string) {
    const ws = new WebSocket(liveSessionSocketUrl(sessionId));
    socket = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", displayName: displayNameInUse, participantToken: readToken(sessionId) }));
    };

    ws.onmessage = (event) => {
      if (socket !== ws) return;
      let message: LiveServerMessage;
      try {
        message = JSON.parse(String(event.data)) as LiveServerMessage;
      } catch {
        return;
      }
      switch (message.type) {
        case "welcome":
          reconnectAttempts = 0;
          writeToken(sessionId, message.participantToken);
          applyRemoteState(message.state);
          set({ status: "connected", endReason: null, participantId: message.participantId, participants: message.participants });
          startSync();
          return;
        case "state":
          applyRemoteState(message.state);
          if (message.change && message.change.participantId !== get().participantId) {
            set({ lastRemoteChange: { ...message.change, seq: ++changeSeq } });
          }
          return;
        case "presence": {
          const present = new Set(message.participants.map((p) => p.id));
          set((s) => ({
            participants: message.participants,
            cursors: Object.fromEntries(Object.entries(s.cursors).filter(([id]) => present.has(id))),
          }));
          return;
        }
        case "cursor":
          set((s) => {
            const cursors = { ...s.cursors };
            if (message.position) cursors[message.participantId] = message.position;
            else delete cursors[message.participantId];
            return { cursors };
          });
          return;
        case "saved":
          set({ lastSaved: { displayName: message.displayName, publicId: message.publicId } });
          return;
        case "error":
          return; // the server follows up with the corrected state
      }
    };

    ws.onclose = (event) => {
      if (socket !== ws) return; // a newer socket replaced this one
      socket = null;
      stopSync();
      set({ cursors: {}, participants: [] });
      const reason = END_REASON_BY_CODE[event.code];
      if (reason || get().status === "ended") {
        set({ status: "ended", endReason: reason ?? get().endReason ?? "failed" });
        return;
      }
      // Anything else is the network: keep trying for a while (AC §5 "Reconnecting…").
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        set({ status: "ended", endReason: "failed" });
        return;
      }
      const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempts, RECONNECT_DELAYS_MS.length - 1)];
      reconnectAttempts += 1;
      set({ status: "reconnecting" });
      reconnectTimer = setTimeout(() => {
        if (get().sessionId === sessionId && get().status === "reconnecting") open(sessionId);
      }, delay);
    };
  }

  return {
    sessionId: null,
    status: "idle",
    endReason: null,
    participantId: null,
    participants: [],
    cursors: {},
    lastRemoteChange: null,
    lastSaved: null,

    connect: (sessionId, displayName) => {
      if (get().sessionId === sessionId && (get().status === "connecting" || get().status === "connected")) return;
      get().leave();
      displayNameInUse = displayName;
      reconnectAttempts = 0;
      set({ sessionId, status: "connecting", endReason: null, participantId: null, participants: [], cursors: {}, lastSaved: null });
      open(sessionId);
    },

    leave: () => {
      clearTimers();
      stopSync();
      const ws = socket;
      socket = null;
      ws?.close(1000, "left");
      heldState = null;
      holdRemote = false;
      set({ sessionId: null, status: "idle", endReason: null, participantId: null, participants: [], cursors: {}, lastRemoteChange: null, lastSaved: null });
    },

    sendCursor: (position) => {
      if (get().status !== "connected") return;
      pendingCursor = position;
      const wait = CURSOR_INTERVAL_MS - (Date.now() - lastCursorSentAt);
      // Hiding the cursor goes out at once; moves are throttled to ~20 a second.
      if (position === null || wait <= 0) {
        if (cursorTimer) clearTimeout(cursorTimer);
        cursorTimer = null;
        lastCursorSentAt = Date.now();
        send({ type: "cursor", position });
        pendingCursor = undefined;
        return;
      }
      if (!cursorTimer) {
        cursorTimer = setTimeout(() => {
          cursorTimer = null;
          if (pendingCursor === undefined) return;
          lastCursorSentAt = Date.now();
          send({ type: "cursor", position: pendingCursor });
          pendingCursor = undefined;
        }, wait);
      }
    },

    setHoldRemote: (hold) => {
      holdRemote = hold;
      if (!hold && heldState) {
        const state = heldState;
        heldState = null;
        applyRemoteState(state);
      }
    },
  };
});
