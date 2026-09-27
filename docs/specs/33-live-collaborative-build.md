# Spec: Live Collaborative Build

**File:** `docs/specs/33-live-collaborative-build.md`
**Status:** Implemented
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
| AC-1 | **Given** a showroom session **When** the user clicks "Start Live Session" (optionally entering a display name) **Then** a `LiveSession` is created from their current build (ephemeral, not a saved `Configuration`; validated against the catalog like a save) and their tab moves onto the shareable link `/configure/{slug}/live/{sessionId}`, where a "Copy Invite Link" button shares it |
| AC-2 | **Given** a second person opens that link **When** they enter an optional name and join **Then** both participants' clients connect via WebSocket to the same session; each sees who's present (names and colors) and the other's pointer as a labeled, colored marker on the car in the 3D scene (a world-space point, so it lands in the right place whatever each person's own camera angle) |
| AC-3 | **Given** either participant changes a selection (single-select categories, accessories/packages, the custom paint color, or the scene) **When** applied **Then** the change is broadcast to all participants and applied to everyone's 3D scene and price within roughly one second; the others get a brief message ("Alex changed the Wheels") |
| AC-4 | **Given** two participants change the *same* single-select category at nearly the same time **When** both changes arrive **Then** the conflict is resolved by last-write-wins per category (the server applies changes in arrival order and sends everyone the resulting state; no operational-transform or CRDT merge logic is needed because a single-select category's state is just "one value"). Accessories and packages are sent as toggles applied to the server's state, so two people adding different ones at once both stick |
| AC-5 | **Given** a live session **When** any participant saves (the Save button, or the saves inside capture, publish, lead requests and reservations) **Then** it saves as a normal `Configuration` (Spec 10), and the others see "{name} saved this build" with a link to it. The session carries on — the session itself is never the persisted artifact, only a real-time editing surface over the same store |
| AC-6 | **Given** a live session with no activity for 30 minutes **When** that elapses **Then** it's automatically closed and its WebSocket connections terminate gracefully, with a clear message. A session nobody is connected to closes after 5 minutes |
| AC-7 | **Given** a participant leaves or disconnects **When** detected **Then** their cursor/presence disappears for the remaining participant(s) within a few seconds — at once for a clean leave, and within about 10 seconds for a dropped connection (5-second heartbeat) |
| AC-8 | **Given** this feature requires no account **When** used **Then** it works entirely in guest mode (SRS §36.5) — participants are identified only by an ephemeral session-local display name (default "Guest") and an auto-assigned color, not a real identity |
| AC-9 | **Given** a participant's connection drops **When** the network returns **Then** the page shows "Reconnecting…" and rejoins automatically with the same name and color |
| AC-10 | **Given** an image capture, video capture or publish is running **When** a partner's change arrives **Then** it waits until the capture finishes, then applies — a partner can never change the scene mid-capture |

---

## 3. API contract

### Endpoints / channels

| Protocol | Route/Event | Notes |
|---|---|---|
| `POST` | `/api/live-sessions` | body `CreateLiveSessionRequest` (the creator's current build); `201` `ApiResponse<LiveSessionDto>`; 5/min per IP |
| `GET` | `/api/live-sessions/:sessionId` | whether the link still works and its vehicle — the join page checks this first; `200` `ApiResponse<LiveSessionDto>` |
| WebSocket | `/ws/live-sessions/:sessionId` | on the API's own HTTP server; only pages from `FRONTEND_ORIGIN` may connect (others get `403`); max 4 KB per message |

Session ids are 16 random characters — the link is the only key, so it must be unguessable. Up to 4 people can be in a session (2 are guaranteed), and at most 500 sessions run at once.

### WebSocket message shapes

```ts
type LiveChange =
  | { kind: "select"; category: SingleSelectCategory; optionId: string }
  | { kind: "toggle"; category: MultiSelectCategory; optionId: string }
  | { kind: "customPaint"; hex: string }
  | { kind: "environment"; environmentId: string | null };

type LiveClientMessage =
  | { type: "join"; displayName: string; participantToken?: string } // must be first
  | { type: "change"; change: LiveChange }
  | { type: "cursor"; position: [number, number, number] | null } // world space; null = off the car
  | { type: "saved"; publicId: string }; // relayed only for a build of this vehicle saved in the last 2 minutes

type LiveServerMessage =
  | { type: "welcome"; participantId: string; participantToken: string; state: LiveStateDto; participants: LiveParticipantDto[] }
  | { type: "state"; state: LiveStateDto; change: { participantId: string; displayName: string; change: LiveChange } | null }
  | { type: "presence"; participants: LiveParticipantDto[] }
  | { type: "cursor"; participantId: string; position: [number, number, number] | null }
  | { type: "saved"; participantId: string; displayName: string; publicId: string }
  | { type: "error"; code: string; message: string }; // followed by the corrected state
```

Every change is validated against the session's vehicle catalog before it's applied. Cursor moves are throttled to about 20 a second (client and server).

**Close codes** the page maps to its UI states: `4404` not found/expired link, `4410` closed for inactivity, `4409` full, `4411` opened in another tab, `4503` turned off, `4400`/`4429` protocol misuse and `1009` (message too big) end it as "connection lost" without retrying. Anything else is treated as a network drop and retried.

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | reused — a missing vehicle or malformed starting build |
| `404` | `VEHICLE_NOT_FOUND` | reused |
| `404` | `LIVE_SESSION_NOT_FOUND` | **new** — the session has ended or never existed |
| `422` | `OPTION_VEHICLE_MISMATCH` | reused — the starting build has an option not on this vehicle |
| `429` | `RATE_LIMITED` | reused |
| `503` | `LIVE_COLLAB_DISABLED` | **new** — `LIVE_COLLAB_ENABLED=false` |
| `503` | `LIVE_SESSIONS_FULL` | **new** — 500 sessions already running |

### Breaking-change check

- [x] First version of this contract; no existing contract touched.

---

## 4. Data model changes

`LiveSession` state is held **in-memory on the WebSocket server process** (or a shared cache like Redis if the backend runs multiple instances — see Risk #2), not in Postgres — it's ephemeral by design (AC-5/AC-6), consistent with "don't add persistence beyond what's needed."

```ts
// backend/src/services/liveSession/registry.ts (in memory, not Prisma)
interface LiveSession {
  id: string;
  vehicleSlug: string;
  catalog: LiveCatalog; // the vehicle's options, custom-paint option and environments, for validation
  state: LiveStateDto; // singleSelections, multiSelections, customPaintHex, environmentId, version
  participants: Map<string, { id; token; displayName; color; connected }>;
  createdAt: number;
  lastActivityAt: number;
  emptySince: number | null;
}
```

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Connecting** | brief "Joining session..." indicator |
| **Connected** | normal showroom UI plus presence cursors/avatars |
| **Session expired/not found** | clear message with an option to start a new solo session |
| **Disconnected (network issue)** | automatic reconnect attempts (1 s, 2 s, 4 s, 8 s, then every 10 s, for about 1.5 minutes) with a visible "Reconnecting…" indicator |
| **Joining by link** | a small card: optional "Your name" and Join. Whoever started or already joined in this tab rejoins without it |
| **Ended** | why (inactivity, full, turned off, opened in another tab, connection lost), with the build still on screen and a button to start a new live session |

Presence (names and colors) sits at the top of the build panel; a partner's change shows a toast (read by screen readers); a partner's save shows a link to that build. Cursors are markers pinned to the car in 3D. Live links are `noindex` and disallowed in `robots.txt`.

**Route(s):** `/configure/[slug]/live/[sessionId]`
**Directory:** `frontend/src/components/showroom/LiveSession/`, `frontend/src/state/liveSessionStore.ts`, `backend/src/ws/liveSession.ts`, `backend/src/services/liveSession/`, `backend/src/routes/liveSessions.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | last-write-wins, accessory toggles, validation, joining/colors/caps, reconnect identity, inactivity and empty-session timeouts, message parsing | `backend/tests/liveSession.test.ts` |
| **Integration** | real WebSocket clients on a real server: join, presence, relay under one second, conflicts, invalid changes, cursors, silent drops, reconnect and same-tab takeover, save announcements, full session, other-origin refusal, 4 KB cap, idle expiry, the flag, the rate limit | `backend/tests/integration/liveSession.int.test.ts` |
| **Store / component** | sync both ways without echoes, holding changes during a capture, cursor throttling, reconnecting, every end reason; the join card, presence, toasts, save link, start errors | `frontend/tests/live/*` |
| **E2E** | two browser contexts join the same session, see each other, one changes the wheels and the other's summary and price follow; the other's browser closes and they disappear; a dead link says so | `frontend/e2e/live-collaboration.spec.ts` |

**Coverage:** ≥80% on new code; conflict-resolution logic at 100% given its correctness importance.

---

## 7. Out of scope

- Voice/video chat between participants — text/cursor presence only.
- More than two participants is only guaranteed for two, matching the SRS's "a friend join" framing; the server allows up to four, mainly as abuse protection.
- Any persistence of the live session's edit history (who changed what, in order) — only the final state matters, per AC-5's save-ends-it design.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | This is by a wide margin the most infrastructurally different spec in the whole project — it requires a stateful WebSocket server, which changes the backend's deployment assumptions (a plain serverless/stateless Express deploy doesn't naturally support long-lived WebSocket connections). | Product owner | Resolved — accepted as the necessary cost of this feature; recommend deploying the backend on a platform supporting persistent connections (e.g. a long-running Node process on Render/Fly.io, not a serverless function model) specifically because of this spec. If the hosting choice can't accommodate this, this spec should be the first cut from the backlog. |
| 2 | If the backend ever runs multiple instances (horizontal scaling), in-memory `LiveSessionState` wouldn't be shared across them — a participant could connect to a different instance than their session lives on. | Implementer | Open — acceptable at this project's expected scale (single instance); would need Redis-backed session state to scale beyond that, deliberately not built now per "don't design for hypothetical future requirements." |
| 3 | Applying last-write-wins per category (AC-4) means one participant's rapid changes could feel like they're "overwriting" the other's, with no visual indication of whose change won. | Product owner | Resolved — each partner change shows a brief toast ("Alex changed the Wheels"). |

---

## 9. Rollout

- **Feature flag:** `LIVE_COLLAB_ENABLED` (backend: the API answers `503 LIVE_COLLAB_DISABLED` and the WebSocket refuses) and `NEXT_PUBLIC_LIVE_COLLAB_ENABLED` (frontend: the Start button is hidden and live links show "unavailable") — given Risk #1's infrastructure implications, this is the easiest feature in the backlog to fully disable without touching anything else.
- **Migration order:** N/A — no Postgres schema.
- **Rollback:** disable the flag / remove the WebSocket route; the rest of the configurator is completely unaffected since this spec never touches the core `configurationStore` contract, only mirrors it over the network.
- **Observability:** logs session creation, joins, leaves and expiry (`[live] created/joined/left/closed`), socket errors, and each change's server relay time at debug level (`[live] change relayed`, `relayMs`). The integration test measures the one-second target end to end.
