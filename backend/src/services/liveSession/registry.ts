import { randomBytes } from "node:crypto";
import { MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES, type OptionCategory } from "../../types/catalog.js";
import type { LiveChange, LiveParticipantDto, LiveSelectionState, LiveStateDto } from "../../types/liveSession.js";
import type { MultiSelectCategory, SingleSelectCategory } from "../../types/pricing.js";

/** A session with no participant activity for this long is closed (AC-6). */
export const INACTIVITY_TIMEOUT_MS = 30 * 60_000;
/** A session nobody is connected to is closed after this grace period (room to reconnect). */
export const EMPTY_SESSION_GRACE_MS = 5 * 60_000;
/** Two are guaranteed (the spec's "a friend joins"); the cap is abuse protection. */
export const MAX_PARTICIPANTS = 4;
/** Caps the memory all sessions together can take on this single-process server. */
export const MAX_SESSIONS = 500;
export const DISPLAY_NAME_MAX_LENGTH = 24;
export const DEFAULT_DISPLAY_NAME = "Guest";
/** One per participant slot, distinct on the dark showroom. */
export const PARTICIPANT_COLORS = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24"] as const;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SESSION_ID = /^[A-Za-z0-9_-]{16}$/;

/** The one vehicle's catalog a session validates every change against — nothing a client sends is trusted. */
export interface LiveCatalog {
  categoryByOptionId: Map<string, OptionCategory>;
  customPaintOptionId: string | null;
  environmentIds: Set<string>;
}

interface Participant {
  id: string;
  token: string;
  displayName: string;
  color: string;
  connected: boolean;
}

export interface LiveSession {
  id: string;
  vehicleSlug: string;
  catalog: LiveCatalog;
  state: LiveStateDto;
  participants: Map<string, Participant>;
  createdAt: number;
  lastActivityAt: number;
  /** When the last participant disconnected; null while anyone is connected (or before anyone joined). */
  emptySince: number | null;
}

export type ChangeResult = { ok: true } | { ok: false; code: "VALIDATION_ERROR" | "OPTION_VEHICLE_MISMATCH"; message: string };

export function isSessionId(value: string): boolean {
  return SESSION_ID.test(value);
}

/** Trimmed, control characters and runs of whitespace removed, capped; empty → "Guest". */
export function normalizeDisplayName(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_DISPLAY_NAME;
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return [...cleaned].slice(0, DISPLAY_NAME_MAX_LENGTH).join("").trim() || DEFAULT_DISPLAY_NAME;
}

/**
 * Checks a whole selection state against the catalog — used for the creator's starting build.
 * (Changes afterwards are validated one at a time by `applyChange`.)
 */
export function validateState(state: LiveSelectionState, catalog: LiveCatalog): ChangeResult {
  for (const category of SINGLE_SELECT_CATEGORIES) {
    const optionId = state.singleSelections?.[category];
    if (typeof optionId !== "string") return { ok: false, code: "VALIDATION_ERROR", message: `${category} is required.` };
    if (catalog.categoryByOptionId.get(optionId) !== category) {
      return { ok: false, code: "OPTION_VEHICLE_MISMATCH", message: `${category} isn't an option on this vehicle.` };
    }
  }
  for (const category of MULTI_SELECT_CATEGORIES) {
    const optionIds = state.multiSelections?.[category];
    if (!Array.isArray(optionIds)) return { ok: false, code: "VALIDATION_ERROR", message: `${category} must be a list.` };
    if (new Set(optionIds).size !== optionIds.length) {
      return { ok: false, code: "VALIDATION_ERROR", message: `${category} has a duplicate.` };
    }
    for (const optionId of optionIds) {
      if (typeof optionId !== "string" || catalog.categoryByOptionId.get(optionId) !== category) {
        return { ok: false, code: "OPTION_VEHICLE_MISMATCH", message: `${category} has an option not on this vehicle.` };
      }
    }
  }
  if (state.customPaintHex !== null) {
    if (typeof state.customPaintHex !== "string" || !HEX_COLOR.test(state.customPaintHex)) {
      return { ok: false, code: "VALIDATION_ERROR", message: "customPaintHex must be a #rrggbb color or null." };
    }
    if (state.singleSelections.PAINT !== catalog.customPaintOptionId) {
      return { ok: false, code: "VALIDATION_ERROR", message: "A custom color needs the Custom Color paint." };
    }
  }
  if (state.environmentId !== null && !catalog.environmentIds.has(state.environmentId)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Unknown environment." };
  }
  return { ok: true };
}

/**
 * Applies one participant's change to the session's authoritative state (AC-3/AC-4). Single-
 * select categories are last-write-wins: the server applies changes in arrival order and
 * everyone gets the resulting state, so the last one to arrive is what everyone sees.
 * Accessories/packages are *toggles* against the current state, so two people adding
 * different accessories at the same moment both stick. Mirrors the configurator store's own
 * rules (e.g. picking a paint clears a custom color).
 */
export function applyChange(state: LiveStateDto, change: LiveChange, catalog: LiveCatalog): ChangeResult {
  switch (change.kind) {
    case "select": {
      if (!(SINGLE_SELECT_CATEGORIES as readonly string[]).includes(change.category)) {
        return { ok: false, code: "VALIDATION_ERROR", message: "Unknown category." };
      }
      if (catalog.categoryByOptionId.get(change.optionId) !== change.category) {
        return { ok: false, code: "OPTION_VEHICLE_MISMATCH", message: "That option isn't in this category on this vehicle." };
      }
      state.singleSelections = { ...state.singleSelections, [change.category]: change.optionId };
      if (change.category === "PAINT") state.customPaintHex = null;
      break;
    }
    case "toggle": {
      if (!(MULTI_SELECT_CATEGORIES as readonly string[]).includes(change.category)) {
        return { ok: false, code: "VALIDATION_ERROR", message: "Unknown category." };
      }
      if (catalog.categoryByOptionId.get(change.optionId) !== change.category) {
        return { ok: false, code: "OPTION_VEHICLE_MISMATCH", message: "That option isn't in this category on this vehicle." };
      }
      const current = state.multiSelections[change.category];
      const next = current.includes(change.optionId)
        ? current.filter((id) => id !== change.optionId)
        : [...current, change.optionId];
      state.multiSelections = { ...state.multiSelections, [change.category]: next };
      break;
    }
    case "customPaint": {
      if (typeof change.hex !== "string" || !HEX_COLOR.test(change.hex)) {
        return { ok: false, code: "VALIDATION_ERROR", message: "A custom color must be #rrggbb." };
      }
      if (state.singleSelections.PAINT !== catalog.customPaintOptionId) {
        return { ok: false, code: "VALIDATION_ERROR", message: "Pick the Custom Color paint first." };
      }
      state.customPaintHex = change.hex.toLowerCase();
      break;
    }
    case "environment": {
      if (change.environmentId !== null && !catalog.environmentIds.has(change.environmentId)) {
        return { ok: false, code: "VALIDATION_ERROR", message: "Unknown environment." };
      }
      state.environmentId = change.environmentId;
      break;
    }
    default:
      return { ok: false, code: "VALIDATION_ERROR", message: "Unknown change." };
  }
  state.version += 1;
  return { ok: true };
}

/** All live sessions, held in this process's memory (Spec 33 §4 — ephemeral by design). */
export class LiveSessionRegistry {
  private sessions = new Map<string, LiveSession>();

  get size(): number {
    return this.sessions.size;
  }

  get(sessionId: string): LiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  /** Starts a session from an already-validated state (AC-1); null when at capacity. */
  create(vehicleSlug: string, catalog: LiveCatalog, initial: LiveSelectionState, now: number): LiveSession | null {
    if (this.sessions.size >= MAX_SESSIONS) return null;
    let id: string;
    do {
      id = randomBytes(12).toString("base64url"); // 16 unguessable characters — the link is the only key
    } while (this.sessions.has(id));
    const session: LiveSession = {
      id,
      vehicleSlug,
      catalog,
      state: {
        singleSelections: { ...initial.singleSelections },
        multiSelections: { ACCESSORY: [...initial.multiSelections.ACCESSORY], PACKAGE: [...initial.multiSelections.PACKAGE] },
        customPaintHex: initial.customPaintHex?.toLowerCase() ?? null,
        environmentId: initial.environmentId,
        version: 0,
      },
      participants: new Map(),
      createdAt: now,
      lastActivityAt: now,
      // Counts as empty from the start: a session nobody ever opens goes after the grace period.
      emptySince: now,
    };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Adds someone to the session, or reconnects them (same id, name and color) when they present
   * the token they were given — so a network blip doesn't change who they are. Null when full.
   */
  join(session: LiveSession, displayName: string, token: string | undefined, now: number): Participant | null {
    const returning = token ? [...session.participants.values()].find((p) => p.token === token) : undefined;
    const connected = [...session.participants.values()].filter((p) => p.connected);
    if (!returning?.connected && connected.length >= MAX_PARTICIPANTS) return null;

    session.lastActivityAt = now;
    session.emptySince = null;
    if (returning) {
      returning.connected = true;
      returning.displayName = displayName;
      return returning;
    }
    const usedColors = new Set(connected.map((p) => p.color));
    const participant: Participant = {
      id: randomBytes(6).toString("base64url"),
      token: randomBytes(18).toString("base64url"),
      displayName,
      color: PARTICIPANT_COLORS.find((c) => !usedColors.has(c)) ?? PARTICIPANT_COLORS[0],
      connected: true,
    };
    session.participants.set(participant.id, participant);
    return participant;
  }

  /** Marks someone gone (AC-7); their record stays so a reconnect keeps their name and color. */
  disconnect(session: LiveSession, participantId: string, now: number): void {
    const participant = session.participants.get(participantId);
    if (participant) participant.connected = false;
    if (![...session.participants.values()].some((p) => p.connected)) session.emptySince = now;
  }

  touch(session: LiveSession, now: number): void {
    session.lastActivityAt = now;
  }

  participantsOf(session: LiveSession): LiveParticipantDto[] {
    return [...session.participants.values()]
      .filter((p) => p.connected)
      .map((p) => ({ id: p.id, displayName: p.displayName, color: p.color }));
  }

  close(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /** Closes and returns every session that's been idle too long (AC-6) or empty past the grace period. */
  sweep(now: number): LiveSession[] {
    const expired: LiveSession[] = [];
    for (const session of this.sessions.values()) {
      const idle = now - session.lastActivityAt >= INACTIVITY_TIMEOUT_MS;
      const abandoned = session.emptySince !== null && now - session.emptySince >= EMPTY_SESSION_GRACE_MS;
      if (idle || abandoned) expired.push(session);
    }
    for (const session of expired) this.sessions.delete(session.id);
    return expired;
  }
}

export function isSingleSelectCategory(value: unknown): value is SingleSelectCategory {
  return (SINGLE_SELECT_CATEGORIES as readonly unknown[]).includes(value);
}

export function isMultiSelectCategory(value: unknown): value is MultiSelectCategory {
  return (MULTI_SELECT_CATEGORIES as readonly unknown[]).includes(value);
}
