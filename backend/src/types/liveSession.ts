import type { MultiSelectCategory, SingleSelectCategory } from "./pricing.js";

/** Everything a live session keeps in sync between participants (Spec 33). */
export interface LiveSelectionState {
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
  customPaintHex: string | null;
  environmentId: string | null;
}

/** POST /api/live-sessions — the creator's current build becomes the session's starting state. */
export interface CreateLiveSessionRequest extends LiveSelectionState {
  vehicleSlug: string;
}

export interface LiveSessionDto {
  sessionId: string;
  vehicleSlug: string;
  /** People connected right now. */
  participantCount: number;
}

export interface LiveParticipantDto {
  id: string;
  displayName: string;
  color: string;
}

/** The session's authoritative state; `version` increases with every applied change. */
export interface LiveStateDto extends LiveSelectionState {
  version: number;
}

export type LiveChange =
  | { kind: "select"; category: SingleSelectCategory; optionId: string }
  | { kind: "toggle"; category: MultiSelectCategory; optionId: string }
  | { kind: "customPaint"; hex: string }
  | { kind: "environment"; environmentId: string | null };

/** A 3D point on the car under the participant's pointer, or null when it's off the car. */
export type LiveCursorPosition = [number, number, number] | null;

/** Messages a browser sends over /ws/live-sessions/:sessionId. `join` must come first. */
export type LiveClientMessage =
  | { type: "join"; displayName: string; participantToken?: string }
  | { type: "change"; change: LiveChange }
  | { type: "cursor"; position: LiveCursorPosition }
  | { type: "saved"; publicId: string };

/** Messages the server sends. */
export type LiveServerMessage =
  | {
      type: "welcome";
      participantId: string;
      /** Rejoin with this to keep the same name and color after a reconnect. */
      participantToken: string;
      state: LiveStateDto;
      participants: LiveParticipantDto[];
    }
  | { type: "state"; state: LiveStateDto; change: { participantId: string; displayName: string; change: LiveChange } | null }
  | { type: "presence"; participants: LiveParticipantDto[] }
  | { type: "cursor"; participantId: string; position: LiveCursorPosition }
  | { type: "saved"; participantId: string; displayName: string; publicId: string }
  | { type: "error"; code: string; message: string };
