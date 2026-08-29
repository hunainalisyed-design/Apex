# Spec: Live Collaborative Build

**File:** `docs/specs/33-live-collaborative-build.md`
**Status:** Draft
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.2 (Live collaborative build); depends on `06-exterior-customization.md` (configuration store), `05-3d-showroom-core.md`, `10-save-share-configuration.md`

---

## 1. Problem statement

**Today:** A configuration session lives entirely in one browser tab (Spec 6's Zustand store). SRS §35.2 wants a shareable link that lets a friend join and configure the same build together in real time, "Figma-style multiplayer cursors, applied to a car" — the single largest engineering item in the entire backlog.

**Who is affected:** Users who want to configure a build together with someone else, live.

**Why it matters now:** It's spec'd last among the trending features deliberately — its design leans on every prior configuration/pricing pattern already established, and its scope is aggressively narrowed below to keep it buildable at all within this project's realistic scope.

**Success looks like:** Two people open the same live-session link, each see the other's cursor/presence, and when either changes a selection, both see the 3D scene and price update within a second — without either needing an account.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a showroom session **When** the user clicks "Start Live Session" **Then** a `LiveSession` is created (ephemeral, not a saved `Configuration`) and a shareable link (`/configure/{slug}/live/{sessionId}`) is generated |
| AC-2 | **Given** a second person opens that link **When** they join **Then** both participants' clients connect via WebSocket to the same session and see each other represented as a labeled cursor/presence indicator in the 3D scene |
| AC-3 | **Given** either participant changes a single-select category (paint, wheels, etc.) **When** applied **Then** the change is broadcast to all participants in the session and applied to everyone's 3D scene and price within roughly one second |
| AC-4 | **Given** two participants change the *same* category at nearly the same time **When** both changes arrive **Then** the conflict is resolved by last-write-wins per category (the server timestamps and broadcasts the final state; no operational-transform or CRDT merge logic is needed because a single-select category's state is just "one value," not freely-editable text) |
| AC-5 | **Given** a live session **When** either participant clicks "Save" **Then** it saves as a normal `Configuration` (Spec 10), ending the live-collaborative aspect — the session itself is never itself the persisted artifact, only a real-time editing surface over the same store both specs already share |
| AC-6 | **Given** a live session with no activity for a defined period (e.g. 30 minutes) **When** that elapses **Then** it's automatically closed and its WebSocket connections terminate gracefully |
| AC-7 | **Given** a participant leaves or disconnects **When** detected **Then** their cursor/presence disappears for the remaining participant(s) within a few seconds |
| AC-8 | **Given** this feature requires no account **When** used **Then** it works entirely in guest mode (SRS §36.5) — participants are identified only by an ephemeral session-local display name/color, not a real identity |

---

## 3. API contract

### Endpoints / channels

| Protocol | Route/Event | Notes |
|---|---|---|
| `POST` | `/api/live-sessions` | creates a session, returns `sessionId` |
| WebSocket | `/ws/live-sessions/:sessionId` | join, presence, and selection-change broadcast |

### WebSocket message shapes

```ts
type ClientMessage =
  | { type: "join"; displayName: string }
  | { type: "cursorMove"; position: [number, number, number] }
  | { type: "selectionChange"; category: SingleSelectCategory | MultiSelectCategory; value: string | string[] };

type ServerMessage =
  | { type: "presenceUpdate"; participants: { id: string; displayName: string; color: string }[] }
  | { type: "cursorUpdate"; participantId: string; position: [number, number, number] }
  | { type: "stateSync"; singleSelections: Record<SingleSelectCategory, string>; multiSelections: Record<MultiSelectCategory, string[]> };
```

### Breaking-change check

- [x] First version of this contract; no existing contract touched.

---

## 4. Data model changes

`LiveSession` state is held **in-memory on the WebSocket server process** (or a shared cache like Redis if the backend runs multiple instances — see Risk #2), not in Postgres — it's ephemeral by design (AC-5/AC-6), consistent with "don't add persistence beyond what's needed."

```ts
// backend/src/services/liveSession/types.ts (in-memory / Redis, not Prisma)
interface LiveSessionState {
  sessionId: string;
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
  participants: Map<string, { displayName: string; color: string; lastSeenAt: number }>;
  createdAt: number;
  lastActivityAt: number;
}
```

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Connecting** | brief "Joining session..." indicator |
| **Connected** | normal showroom UI plus presence cursors/avatars |
| **Session expired/not found** | clear message with an option to start a new solo session |
| **Disconnected (network issue)** | automatic reconnect attempt with a visible "Reconnecting..." indicator |

**Route(s):** `/configure/[slug]/live/[sessionId]`
**Directory:** `frontend/src/components/showroom/LiveSession/`, `backend/src/ws/liveSession.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | last-write-wins conflict resolution, inactivity-timeout logic | `backend/tests/liveSession.test.ts` |
| **Integration** | WebSocket join/broadcast/leave flow with two mocked clients | `backend/tests/integration/liveSession.int.test.ts` |
| **E2E** | two browser contexts join the same session, one changes wheels, assert the other's scene/price updates within the expected window | `frontend/e2e/live-collaboration.spec.ts` |

**Coverage:** ≥80% on new code; conflict-resolution logic at 100% given its correctness importance.

---

## 7. Out of scope

- Voice/video chat between participants — text/cursor presence only.
- More than two participants — while the design doesn't hard-block a third, it's only tested and guaranteed for two, matching the SRS's "a friend join" framing.
- Any persistence of the live session's edit history (who changed what, in order) — only the final state matters, per AC-5's save-ends-it design.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | This is by a wide margin the most infrastructurally different spec in the whole project — it requires a stateful WebSocket server, which changes the backend's deployment assumptions (a plain serverless/stateless Express deploy doesn't naturally support long-lived WebSocket connections). | Product owner | Resolved — accepted as the necessary cost of this feature; recommend deploying the backend on a platform supporting persistent connections (e.g. a long-running Node process on Render/Fly.io, not a serverless function model) specifically because of this spec. If the hosting choice can't accommodate this, this spec should be the first cut from the backlog. |
| 2 | If the backend ever runs multiple instances (horizontal scaling), in-memory `LiveSessionState` wouldn't be shared across them — a participant could connect to a different instance than their session lives on. | Implementer | Open — acceptable at this project's expected scale (single instance); would need Redis-backed session state to scale beyond that, deliberately not built now per "don't design for hypothetical future requirements." |
| 3 | Applying last-write-wins per category (AC-4) means one participant's rapid changes could feel like they're "overwriting" the other's, with no visual indication of whose change won. | Product owner | Open — consider a brief toast ("Alex just changed the wheels") as a UX mitigation during implementation; not required for the feature to function correctly. |

---

## 9. Rollout

- **Feature flag:** `LIVE_COLLAB_ENABLED` — given Risk #1's infrastructure implications, this should be the easiest feature in the backlog to fully disable without touching anything else.
- **Migration order:** N/A — no Postgres schema.
- **Rollback:** disable the flag / remove the WebSocket route; the rest of the configurator is completely unaffected since this spec never touches the core `configurationStore` contract, only mirrors it over the network.
- **Observability:** log session creation/join/close events and message-broadcast latency — the "within roughly one second" target in AC-3 needs real measurement to confirm.
