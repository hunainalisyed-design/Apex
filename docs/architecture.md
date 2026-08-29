# Architecture — APEX Virtual Car Configurator

**Status:** Derived documentation, synthesized from the approved/drafted specs in [`docs/specs/`](specs/README.md).
**Source of truth note:** This document describes *how* the system specified in [`Virtual car configurator spec · MD`](../Virtual%20car%20configurator%20spec%20%C2%B7%20MD) (the SRS) is built. Where this document and an individual spec file disagree, the spec file wins — this is a synthesis for orientation and cross-referencing, not a new source of independent decisions. Every claim below traces to a specific spec number; those numbers match both `docs/specs/README.md`'s index and each file's `NN-<slug>.md` filename.

---

## 1. System Overview & High-Level Architecture

The system is a two-application architecture: a **Next.js frontend** and a separate **Node.js/Express backend**, communicating over a REST API (plus one WebSocket channel for Spec 33). This split — rather than using Next.js API routes for everything — was a deliberate decision recorded in Spec 01 and `docs/specs/README.md`, keeping the 3D/UI application and the data/business-logic application independently deployable and testable.

```
┌─────────────────────┐         REST (+ WS for Spec 33)        ┌──────────────────────┐
│   Frontend (Next.js) │ ──────────────────────────────────────▶│  Backend (Express)   │
│   Three.js / R3F     │◀────────────────────────────────────── │  Prisma / PostgreSQL │
│   Zustand stores      │                                        │  Claude API, Stripe,  │
└─────────────────────┘                                        │  Resend, Sentry, WS   │
                                                                 └──────────────────────┘
```

Foundational stack decisions (Spec 01, `docs/specs/README.md`):

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js (React) | Enables SSR/edge OG image generation (Spec 23) — the original SRS listed Vite, which cannot do this. |
| 3D | Three.js + React Three Fiber + Drei | Per SRS §24, unchanged. |
| Backend | Node.js + Express | Per SRS §24, unchanged; kept as a separate app from Next.js. |
| Database | PostgreSQL + Prisma | Relational integrity for pricing, users, reservations (Spec 02). |
| AI (text) | Claude API (tool-use) | Structured, enum-constrained output (Spec 14). |
| AI (image) | Provider TBD | Spec 35 — deliberately unresolved, a separate vendor decision from Claude. |

---

## 2. Frontend Architecture

### 2.1 Application structure (Spec 01)

```
frontend/
├── src/
│   ├── app/                # Next.js App Router routes
│   ├── components/         # organized by feature: showroom/, configurator/, ai/, auth/, garage/, gallery/, compare/, admin/, shell/, leads/, reservations/, consent/, ar/
│   ├── lib/                 # showroom/, motion/, errors/, sound/, voice/, format/, imageGeneration client helpers
│   ├── state/                # Zustand stores
│   └── i18n/                 # Spec 26
└── public/
    ├── models/               # GLB/GLTF/USDZ assets
    └── audio/                # Spec 29
```

### 2.2 The 3D rendering layer (Spec 05)

The showroom is built on React Three Fiber, with a **hotspot registry** (`frontend/src/lib/showroom/hotspots.ts`, Spec 05) mapping GLB mesh names to `OptionCategory` values — this is the single mechanism every customization spec (06, 07, 08) plugs into to make hovering a part show the currently-selected option's name, without each spec reinventing hover/highlight logic.

Camera control is a named-preset system (Front/Rear/Left/Right/Side/Top/Interior/Cockpit + Reset, Spec 05) with eased transitions, reused by:
- Spec 07 (auto-transition into Interior when the interior panel opens)
- Spec 13 (the landing page's scroll-driven showcase reuses the same preset math)
- Spec 18 (comparison's shared-camera 3D view)
- Spec 30/36/37 (video capture orbit, before/after slider capture, drive-it mode)

### 2.3 State management

One canonical Zustand store per concern, each defined once and extended by later specs rather than duplicated:

| Store | Defined in | Shape | Extended by |
|---|---|---|---|
| `configurationStore` | Spec 06 | `{ vehicleSlug, singleSelections: Record<SingleSelectCategory,string>, multiSelections: Record<MultiSelectCategory,string[]>, customPaintHex }` | Spec 07, 08 (categories only, no new store) |
| `carAiChatStore` | Spec 15 | message history, loading state, apply-to-`configurationStore` action | Spec 34 (voice input feeds the same `sendMessage`) |
| Sound/voice preference | Spec 29 | mute/speak-replies flags in `localStorage` | Spec 34 |

`configurationStore.singleSelections`/`multiSelections` intentionally mirror the backend's `PriceCalculationRequest` shape (Spec 03) exactly, so pricing calls require no reshaping between frontend state and the wire format.

### 2.4 Shared UI shell (Spec 12)

`<ShowroomLoadingScreen>`, `<Static3DFallback>`, `<AppErrorBoundary>`, `<ToastProvider>`/`useToast()`, and `<ShowroomLayout>` (responsive left/right ↔ top/bottom composition) are defined once in Spec 12 and consumed by every other UI-bearing spec. `getErrorMessage(code)` (Spec 12) is the single mapping from backend `ApiError.code` values to human-readable text (SRS §28); every spec that introduces a new error code (14's `AI_PROVIDER_ERROR`, 16's `INVALID_CREDENTIALS`, etc.) adds one row to this table rather than building its own message logic.

`withReducedMotion(animate, instant)` (Spec 12, backed by Spec 01's `useReducedMotion` hook) is the single reduced-motion dispatch mechanism used by every animated spec (04, 05, 13, 15, 28, 34, 37) — Spec 37 is the one exception that omits itself entirely under reduced motion rather than offering a static fallback, since its whole value is motion.

---

## 3. Backend Architecture

### 3.1 Structure (Spec 01)

```
backend/
├── src/
│   ├── routes/          # one file per resource: vehicles, pricing, configurations, ai, auth, me, leads, reservations, admin, gallery, garage
│   ├── services/         # ai/, auth/, assets/, imageGeneration/, liveSession/
│   ├── middleware/        # requireAdmin (Spec 21), session auth (Spec 16)
│   ├── jobs/              # computeComboRarity (Spec 32), guest-configuration/reset-token cleanup (Specs 10, 16)
│   ├── ws/                # liveSession.ts (Spec 33)
│   └── types/              # shared DTOs per spec
└── prisma/
    ├── schema.prisma
    └── seed.ts
```

### 3.2 Service-layer pattern

Each spec that introduces server-side computation isolates it as a pure, independently-testable function, called from a thin route handler:

- **Pricing** (Spec 03): one function, `calculatePrice(vehicle, singleSelections, multiSelections)`, called by `/api/pricing/calculate` directly and internally by Spec 10's save endpoint and Spec 14's AI endpoint — there is exactly one place the total-price formula is implemented server-side.
- **AI tool-schema construction** (Spec 14): `buildConfigureToolSchema(vehicle)` rebuilds Claude's enum-constrained tool parameters fresh from the live catalog on every request — never cached stale.
- **Auth** (Spec 16): password hashing, session token generation/hashing, and reset-token issuance are each isolated functions under `backend/src/services/auth/`, independently unit-tested given their security role.

---

## 4. Data Model & Database Architecture

### 4.1 Core entities and their owning specs

| Entity | Owning spec | Key relationships |
|---|---|---|
| `Vehicle` | Spec 02 | has many `CustomizationOption`, `Configuration` |
| `CustomizationOption` | Spec 02 (schema), Spec 06/08 (`applyMode`, `customPaintHex` on `Configuration`) | belongs to `Vehicle`; category is one of 18 values across `SINGLE_SELECT_CATEGORIES`/`MULTI_SELECT_CATEGORIES` |
| `Configuration` | Spec 02 (schema), Spec 10 (persistence), Spec 17 (`userId` claim), Spec 28 (`environmentId`), Spec 31 (`isPublished`) | belongs to `Vehicle`, optionally `User`, `Environment`; has many `ConfigurationSelection`, `Like` |
| `ConfigurationSelection` | Spec 02 | join table, `Configuration` ↔ `CustomizationOption` |
| `User` | Spec 16 | has many `Session`, `PasswordResetToken`, `Configuration`, `Lead`, `Reservation`, `Like` |
| `Session` / `PasswordResetToken` | Spec 16 | store only hashes of tokens, never raw values |
| `Lead` | Spec 19 | belongs to `Configuration`, optionally `User` |
| `Reservation` | Spec 20 | belongs to `Configuration`, optionally `User` |
| `Environment` | Spec 28 | referenced by `Configuration.environmentId` |
| `Like` | Spec 31 | join table, `User` ↔ `Configuration` |
| `ComboRarityStat` | Spec 32 | aggregate cache, no direct FK to `Configuration` rows |
| `AuditLogEntry` | Spec 21 | references the acting `User` (admin) |

`LiveSession` (Spec 33) is deliberately **not** a Postgres table — it's held in-memory (or Redis, if horizontally scaled) on the WebSocket server process, since it's ephemeral by design.

### 4.2 Category taxonomy (Spec 02, corrected)

The `OptionCategory` enum has 18 values: 9 exterior (`PAINT`, `WHEELS`, `BRAKE_CALIPER`, `WINDOW_TINT`, `SPOILER`, `FRONT_ACCESSORY`, `REAR_ACCESSORY`, `BODY_PACKAGE`, `CARBON_COMPONENT`), 7 interior (`INTERIOR_MATERIAL`, `INTERIOR_LIGHTING`, `INTERIOR_SEATS`, `INTERIOR_DASHBOARD`, `INTERIOR_STEERING_WHEEL`, `INTERIOR_DOOR_PANELS`, `INTERIOR_FLOOR`), and 2 cross-cutting (`ACCESSORY`, `PACKAGE`). Sixteen are single-select-with-a-required-default; two (`ACCESSORY`, `PACKAGE`) are multi-select with no default required. This split is exported once as `SINGLE_SELECT_CATEGORIES`/`MULTI_SELECT_CATEGORIES` (Spec 02) and consumed everywhere else.

### 4.3 Money and identifiers

Every price is an integer number of cents (never a float), formatted for display only at the UI layer (Spec 26 adds locale-awareness on top of this). Shareable configuration links use a human-friendly `publicId` (e.g. `APEX-7F82-K91X`, Spec 10), distinct from the internal `cuid()` primary key.

---

## 5. API Contract Conventions

### 5.1 Envelopes (Spec 01)

Every successful response is wrapped `ApiResponse<T>`; every error follows:

```ts
interface ApiError {
  code: string;    // SCREAMING_SNAKE_CASE, stable forever once shipped
  message: string;
  details?: Record<string, string[]>;
}
```

New error codes are declared in the introducing spec's "Error codes" table before use. As of Spec 37, the accumulated code set spans catalog/pricing errors (Spec 02/03: `VEHICLE_NOT_FOUND`, `OPTION_VEHICLE_MISMATCH`, `DUPLICATE_OPTION_SELECTION`, `VALIDATION_ERROR`), save/share (Spec 10: `CONFIGURATION_NOT_FOUND`), AI (Spec 14: `AI_PROVIDER_ERROR`; Spec 35: `IMAGE_PROVIDER_ERROR`), auth (Spec 16: `EMAIL_ALREADY_REGISTERED`, `INVALID_CREDENTIALS`, `TOO_MANY_ATTEMPTS`, `INVALID_OR_EXPIRED_TOKEN`), garage (Spec 17: `ALREADY_CLAIMED`), and gallery (Spec 31: `NOT_BUILD_OWNER`).

### 5.2 Endpoint inventory by spec

| Spec | Endpoints |
|---|---|
| 01 | `GET /api/health` |
| 02 | `GET /api/vehicles`, `GET /api/vehicles/:slug`, `GET /api/vehicles/:slug/options` |
| 03 | `POST /api/pricing/calculate` |
| 10 | `POST /api/configurations`, `GET /api/configurations/:publicId` |
| 14 | `POST /api/ai/configure` |
| 16 | `POST /api/auth/signup`, `/login`, `/logout`, `GET /api/auth/me`, `POST /api/auth/forgot-password`, `/reset-password` |
| 17 | `GET /api/me/configurations`, `DELETE /api/configurations/:publicId`, `POST /api/configurations/:publicId/claim`, `PUT /api/me/profile`, `PUT /api/me/password` |
| 19 | `POST /api/leads` |
| 20 | `POST /api/reservations/checkout-session`, `POST /api/reservations/webhook`, `GET /api/reservations/:id` |
| 21 | `POST/PUT/DELETE /api/admin/vehicles*`, `/api/admin/options*`, `GET/PUT /api/admin/leads`, `GET /api/admin/reservations` |
| 24 | `GET /api/me/export`, `DELETE /api/me` |
| 26 | `GET /api/docs`, `GET /api/docs/ui` |
| 27 | `POST /api/ar/export` |
| 28 | `GET /api/environments` |
| 31 | `POST /api/configurations/:publicId/publish`/`unpublish`, `GET /api/gallery`, `POST /api/gallery/:publicId/like` |
| 32 | `GET /api/vehicles/:slug/combo-rarity` |
| 33 | `POST /api/live-sessions`, WS `/ws/live-sessions/:sessionId` |
| 35 | `POST /api/ai/concept-render` |

No endpoint listed above requires authentication except where explicitly noted (Spec 17's `/api/me/*`, Spec 21's `/api/admin/*`, Spec 24's `/api/me/*`, Spec 31's publish/like actions) — everything else is guest-accessible per SRS §36.5.

---

## 6. AI Integration Architecture

### 6.1 Text: CarAI (Spec 14, 15, 34)

The core safety design is **structural, not just validated after the fact**: `POST /api/ai/configure` builds a Claude tool-use schema whose enum parameters are generated fresh, per request, from the target vehicle's live `CustomizationOption` catalog (Spec 14, AC-1). The model cannot select an option that doesn't exist for that vehicle, by construction. A second, independent validation pass (AC-2) re-checks every returned `(category, optionId)` pair regardless, and the price of any recommendation is always computed by Spec 03's real pricing function server-side — never trusted from the model's own output (AC-3).

Spec 15 is the sole frontend consumer of this endpoint; it owns conversation state entirely client-side (stateless backend). Spec 34 (voice) and Spec 36 (before/after slider) are both additive layers on top of Spec 15 — voice transcribes to the same text input Spec 15 already sends, and the slider visualizes Spec 15's existing recommendation data. Neither touches Spec 14's contract.

### 6.2 Image: Concept Renders (Spec 35)

A structurally separate capability — Claude does not generate images. Abstracted behind `ImageGenerationProvider` (one method: `generate(prompt)`), with the concrete vendor **explicitly left as an open decision** rather than picked by this documentation, since it's a distinct paid third-party relationship from the Claude API commitment. Output is never persisted and never carries an "Apply" action — it's explicitly non-buildable inspirational content (AC-2/AC-3), architecturally firewalled from the real, catalog-constrained recommendation path in §6.1.

---

## 7. Real-Time / WebSocket Architecture

Spec 33 is the only feature requiring a persistent connection. Its design deliberately avoids CRDT/operational-transform complexity: because a single-select category's state is just "one current value" (not freely-editable text), conflicting simultaneous edits resolve via **last-write-wins per category**, broadcast from an in-memory (or Redis-backed, if scaled) `LiveSessionState` on the WebSocket server. This is the one spec with a materially different deployment requirement — see §10.

---

## 8. Authentication & Authorization Architecture

### 8.1 Sessions, not JWTs (Spec 16)

An httpOnly, `Secure`, `SameSite=Lax` cookie holds an opaque random token; the backend stores only its **hash** in a `Session` row. This allows real server-side revocation (logout; forced re-login everywhere after a password reset, AC-7) without JWT-blocklist machinery. Passwords are bcrypt-hashed (cost 12) and never returned in any DTO.

### 8.2 Guest-first design (SRS §36.5, honored throughout)

Every Phase 1/2 feature works without an account. Auth becomes load-bearing only for: My Garage (Spec 17), publishing to the gallery (Spec 31), and — implicitly, by requiring `POST /api/leads`/`/reservations` to optionally attach a `userId` — leads/reservations (Specs 19, 20). `Configuration.userId` has been nullable since Spec 02 specifically to support this from the start, rather than being retrofitted.

### 8.3 Admin authorization (Spec 21)

A single `User.role` (`USER` | `ADMIN`) flag, checked by a `requireAdmin` middleware that returns a generic `404` (not `403`) for non-admins — deliberately not confirming the admin route's existence to an unauthorized caller.

---

## 9. Third-Party Integrations

| Provider | Used by | Notes |
|---|---|---|
| Claude API (Anthropic) | Spec 14 | Text recommendations, tool-use/enum-constrained. |
| Image-generation API (unchosen) | Spec 35 | Abstracted behind `ImageGenerationProvider`; vendor decision open. |
| Stripe (test mode only, permanently) | Spec 20 | Checkout Session (hosted, no card data touches this app); webhook-driven confirmation. See `docs/CLAUDE.md`'s explicit "test-mode only, permanently" constraint. |
| Resend (recommended, not mandated) | Specs 16, 19 | Transactional email: password reset, lead notifications. |
| Sentry | Spec 22 | Frontend + backend error monitoring, with PII scrubbing enabled (cross-referenced with Spec 24). |
| Analytics provider (unchosen) | Spec 23 | Gated entirely behind Spec 24's consent state; recommend privacy-friendly/cookie-light. |
| GitHub Actions + Vercel/hosting previews | Spec 22 | CI gates + preview deployments. |

---

## 10. Deployment Architecture

- **Frontend:** Vercel (Next.js), per SRS §24 and Spec 23's OG-image/edge rendering needs.
- **Backend:** must run as a **long-lived Node process** (e.g. Render/Fly.io), not a stateless serverless function — this requirement is driven specifically by Spec 33's WebSocket server (§7 above). If the hosting choice can't accommodate persistent connections, Spec 33 is the first feature to cut, not the hosting model to compromise on for everything else.
- **Database:** managed PostgreSQL (Spec 02).
- **Assets:** content-addressed/versioned GLB, USDZ (Spec 27), and HDRI (Spec 28) files, served with long-lived immutable caching (Spec 25) — never overwritten in place, so previously-shared `Configuration` links don't silently change appearance.
- **CI/CD:** GitHub Actions gating lint/typecheck/test/build on every PR, with preview deployments (Spec 22).

---

## 11. Cross-Cutting Concerns

- **Error handling:** every error surface funnels through Spec 12's `getErrorMessage(code)` — no raw stack traces, codes, or provider error text ever reach a user (SRS §28), enforced from Spec 01's `ApiError` envelope through every subsequent spec's error-code additions.
- **Accessibility:** keyboard operability, visible focus rings, and `prefers-reduced-motion` handling are established once (Spec 01's `useReducedMotion`, Spec 12's `withReducedMotion`/focus-visible utility/skip link) and required by every interactive spec's acceptance criteria thereafter — never re-implemented per feature.
- **Performance:** progressive loading and a determinate "INITIALIZING SHOWROOM..." screen (Spec 12) gate every 3D-heavy page; WebGL-capability detection with a static-image fallback (Spec 12, `Vehicial.fallbackImageUrl`) ensures no user is ever shown a broken canvas.
- **Security:** no fake interactions (SRS §32) is treated as an architectural constraint, not just a UX guideline — every customization category's `applyMode` (Spec 06/08) maps to a real 3D material/mesh/visibility change wherever the asset exists. Rate limiting is called out explicitly wherever an endpoint is both unauthenticated and costly (Spec 10's guest saves, Spec 14/35's paid AI calls, Spec 16's login attempts).
- **Observability:** structured logging around AI calls and pricing (Spec 22) plus Sentry error capture are the two primary signals; several specs (10, 14, 33) additionally call out their own latency/outcome logging needs explicitly, given they're the highest-risk-of-silent-failure paths in the system.
