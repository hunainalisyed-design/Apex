import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { logger } from "../lib/logger.js";
import {
  applyChange,
  isLiveCollabEnabled,
  isMultiSelectCategory,
  isSavedBuildOf,
  isSessionId,
  isSingleSelectCategory,
  liveSessions,
  normalizeDisplayName,
  type LiveSession,
  type LiveSessionRegistry,
} from "../services/liveSession/index.js";
import type { LiveChange, LiveClientMessage, LiveCursorPosition, LiveServerMessage } from "../types/liveSession.js";

/** WebSocket close codes the frontend maps to its UI states (4000–4999 is the app-defined range). */
export const CLOSE = {
  INVALID: 4400,
  NOT_FOUND: 4404,
  FULL: 4409,
  EXPIRED: 4410,
  REPLACED: 4411,
  TOO_MANY_MESSAGES: 4429,
  DISABLED: 4503,
} as const;

const PATH = /^\/ws\/live-sessions\/([^/?#]+)$/;
const MAX_PAYLOAD_BYTES = 4096;
const JOIN_TIMEOUT_MS = 10_000;
/** Per connection, per second: cursor moves beyond this are dropped; everything beyond the hard cap closes it. */
const CURSOR_PER_SECOND = 20;
const MESSAGES_PER_SECOND_HARD_CAP = 100;
/** Shape only — isSavedBuildOf() checks the build really exists. */
const PUBLIC_ID = /^\S{1,40}$/;

interface Connection {
  socket: WebSocket;
  session: LiveSession;
  participantId: string | null;
  alive: boolean;
  windowStart: number;
  messagesInWindow: number;
  cursorsInWindow: number;
}

export interface LiveSessionServerOptions {
  /** Only pages from this origin may connect — blocks other sites opening sockets as the visitor. */
  allowedOrigin: string;
  registry?: LiveSessionRegistry;
  pingIntervalMs?: number;
  sweepIntervalMs?: number;
  now?: () => number;
}

function isFiniteTriple(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n));
}

/** Narrows untrusted JSON to a well-formed client message, or null. Semantics are checked later. */
export function parseClientMessage(raw: string): LiveClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const msg = data as Record<string, unknown>;
  switch (msg.type) {
    case "join":
      if (msg.participantToken !== undefined && typeof msg.participantToken !== "string") return null;
      return { type: "join", displayName: normalizeDisplayName(msg.displayName), participantToken: msg.participantToken as string | undefined };
    case "cursor":
      if (msg.position !== null && !isFiniteTriple(msg.position)) return null;
      return { type: "cursor", position: msg.position as LiveCursorPosition };
    case "saved":
      return typeof msg.publicId === "string" && PUBLIC_ID.test(msg.publicId) ? { type: "saved", publicId: msg.publicId } : null;
    case "change": {
      const change = msg.change as Record<string, unknown> | undefined;
      if (!change || typeof change !== "object") return null;
      if (change.kind === "select" && isSingleSelectCategory(change.category) && typeof change.optionId === "string") {
        return { type: "change", change: { kind: "select", category: change.category, optionId: change.optionId } };
      }
      if (change.kind === "toggle" && isMultiSelectCategory(change.category) && typeof change.optionId === "string") {
        return { type: "change", change: { kind: "toggle", category: change.category, optionId: change.optionId } };
      }
      if (change.kind === "customPaint" && typeof change.hex === "string") {
        return { type: "change", change: { kind: "customPaint", hex: change.hex } };
      }
      if (change.kind === "environment" && (change.environmentId === null || typeof change.environmentId === "string")) {
        return { type: "change", change: { kind: "environment", environmentId: change.environmentId as string | null } };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * The live-session WebSocket endpoint (Spec 33): /ws/live-sessions/:sessionId on the same HTTP
 * server as the API. The first message must be `join`; after that, changes are validated
 * against the session's catalog, applied to the server's state, and the resulting state goes to
 * everyone (the sender included — the server's copy is the truth). A ping every few seconds
 * finds dropped connections (AC-7); a periodic sweep closes idle/abandoned sessions (AC-6).
 */
export function attachLiveSessionServer(server: Server, options: LiveSessionServerOptions): { close: () => void } {
  const registry = options.registry ?? liveSessions;
  const now = options.now ?? Date.now;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });
  wss.on("error", (err) => logger.error({ err: { message: err.message } }, "[live] server error"));
  const bySession = new Map<string, Set<Connection>>();

  function send(connection: Connection, message: LiveServerMessage) {
    if (connection.socket.readyState === WebSocket.OPEN) connection.socket.send(JSON.stringify(message));
  }

  function broadcast(sessionId: string, message: LiveServerMessage, except?: Connection) {
    const payload = JSON.stringify(message);
    for (const connection of bySession.get(sessionId) ?? []) {
      if (connection !== except && connection.participantId && connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(payload);
      }
    }
  }

  function presence(session: LiveSession) {
    broadcast(session.id, { type: "presence", participants: registry.participantsOf(session) });
  }

  function onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const match = PATH.exec(new URL(req.url ?? "/", "http://localhost").pathname);
    if (!match) return; // not ours — leave it for any other upgrade handler
    if (req.headers.origin !== options.allowedOrigin) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, decodeURIComponent(match[1])));
  }

  function onConnection(socket: WebSocket, sessionId: string) {
    // A socket-level error (e.g. a message over maxPayload, or a malformed frame) is emitted as
    // an 'error' event before `ws` closes the socket — with no listener, Node would treat it as
    // an unhandled error and crash the whole server. Log it; the close handler does the rest.
    socket.on("error", (err) => logger.warn({ err: { message: err.message }, sessionId }, "[live] socket error"));
    // Accept, then close with a specific code: browsers hide a refused upgrade's HTTP status, but
    // they do expose close codes, which is how the page tells "expired" from "full" from "off".
    if (!isLiveCollabEnabled()) return socket.close(CLOSE.DISABLED, "Live sessions are turned off.");
    const session = isSessionId(sessionId) ? registry.get(sessionId) : undefined;
    if (!session) return socket.close(CLOSE.NOT_FOUND, "Session not found or expired.");

    const connection: Connection = {
      socket,
      session,
      participantId: null,
      alive: true,
      windowStart: now(),
      messagesInWindow: 0,
      cursorsInWindow: 0,
    };
    if (!bySession.has(session.id)) bySession.set(session.id, new Set());
    bySession.get(session.id)!.add(connection);

    const joinTimer = setTimeout(() => {
      if (!connection.participantId) socket.close(CLOSE.INVALID, "Expected a join message.");
    }, JOIN_TIMEOUT_MS);

    socket.on("pong", () => {
      connection.alive = true;
    });
    socket.on("message", (data) => {
      void onMessage(connection, data.toString()).catch((err: unknown) => logger.error({ err }, "[live] message failed"));
    });
    socket.on("close", () => {
      clearTimeout(joinTimer);
      bySession.get(session.id)?.delete(connection);
      const participantId = connection.participantId;
      if (!participantId || !registry.get(session.id)) return;
      // Another tab of the same participant replaced this one — they haven't left.
      if ([...(bySession.get(session.id) ?? [])].some((c) => c.participantId === participantId)) return;
      registry.disconnect(session, participantId, now());
      broadcast(session.id, { type: "cursor", participantId, position: null });
      presence(session);
      logger.info({ sessionId: session.id, participants: registry.participantsOf(session).length }, "[live] left");
    });
  }

  async function onMessage(connection: Connection, raw: string) {
    const { session, socket } = connection;
    if (!registry.get(session.id)) return;

    const t = now();
    if (t - connection.windowStart >= 1000) {
      connection.windowStart = t;
      connection.messagesInWindow = 0;
      connection.cursorsInWindow = 0;
    }
    if (++connection.messagesInWindow > MESSAGES_PER_SECOND_HARD_CAP) {
      socket.close(CLOSE.TOO_MANY_MESSAGES, "Too many messages.");
      return;
    }

    const message = parseClientMessage(raw);
    if (!message) {
      send(connection, { type: "error", code: "VALIDATION_ERROR", message: "Malformed message." });
      return;
    }

    if (!connection.participantId) {
      if (message.type !== "join") return socket.close(CLOSE.INVALID, "Expected a join message.");
      const participant = registry.join(session, message.displayName, message.participantToken, t);
      if (!participant) return socket.close(CLOSE.FULL, "This session is full.");
      // The same person reconnecting from a stale socket: the new connection takes over.
      for (const other of bySession.get(session.id) ?? []) {
        if (other !== connection && other.participantId === participant.id) {
          other.participantId = null;
          other.socket.close(CLOSE.REPLACED, "Reconnected elsewhere.");
        }
      }
      connection.participantId = participant.id;
      send(connection, {
        type: "welcome",
        participantId: participant.id,
        participantToken: participant.token,
        state: session.state,
        participants: registry.participantsOf(session),
      });
      presence(session);
      logger.info({ sessionId: session.id, participants: registry.participantsOf(session).length }, "[live] joined");
      return;
    }

    const participant = session.participants.get(connection.participantId);
    if (!participant) return;

    switch (message.type) {
      case "join":
        return; // already joined
      case "cursor":
        if (++connection.cursorsInWindow > CURSOR_PER_SECOND) return;
        registry.touch(session, t);
        broadcast(session.id, { type: "cursor", participantId: participant.id, position: message.position }, connection);
        return;
      case "change": {
        const result = applyChange(session.state, message.change as LiveChange, session.catalog);
        if (!result.ok) {
          // The sender's screen may have drifted: correct it with the real state.
          send(connection, { type: "error", code: result.code, message: result.message });
          send(connection, { type: "state", state: session.state, change: null });
          return;
        }
        registry.touch(session, t);
        broadcast(session.id, {
          type: "state",
          state: session.state,
          change: { participantId: participant.id, displayName: participant.displayName, change: message.change },
        });
        logger.debug({ sessionId: session.id, kind: message.change.kind, relayMs: now() - t }, "[live] change relayed");
        return;
      }
      case "saved":
        // Announced to the others (decision: a save doesn't end the session) — only if it's a
        // real build of this vehicle saved just now, so nobody can push arbitrary links.
        if (!(await isSavedBuildOf(message.publicId, session.vehicleSlug, Date.now()))) return;
        registry.touch(session, t);
        broadcast(
          session.id,
          { type: "saved", participantId: participant.id, displayName: participant.displayName, publicId: message.publicId },
          connection,
        );
        return;
    }
  }

  function closeSession(session: LiveSession, code: number, reason: string) {
    for (const connection of bySession.get(session.id) ?? []) connection.socket.close(code, reason);
    bySession.delete(session.id);
  }

  const ping = setInterval(() => {
    for (const connections of bySession.values()) {
      for (const connection of connections) {
        if (!connection.alive) {
          connection.socket.terminate(); // fires "close" → presence update (AC-7)
          continue;
        }
        connection.alive = false;
        connection.socket.ping();
      }
    }
  }, options.pingIntervalMs ?? 5_000);
  ping.unref();

  const sweep = setInterval(() => {
    for (const session of registry.sweep(now())) {
      closeSession(session, CLOSE.EXPIRED, "Session expired.");
      logger.info({ sessionId: session.id, lifetimeMs: now() - session.createdAt }, "[live] closed (expired)");
    }
  }, options.sweepIntervalMs ?? 60_000);
  sweep.unref();

  server.on("upgrade", onUpgrade);

  return {
    close() {
      clearInterval(ping);
      clearInterval(sweep);
      server.off("upgrade", onUpgrade);
      for (const connections of bySession.values()) for (const c of connections) c.socket.terminate();
      bySession.clear();
      wss.close();
    },
  };
}
