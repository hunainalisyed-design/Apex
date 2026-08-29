# Spec: Project Foundation

**File:** `docs/specs/01-project-foundation.md`
**Status:** Approved
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §24 (Technology Stack), §25 (Suggested Project Architecture)

---

## 1. Problem statement

**Today:** The repository contains only planning documents (SRS, spec template, spec index). No application code, no runtime, no package manifests, and no database exist yet.

**Who is affected:** Every subsequent spec in this index depends on a working frontend app, backend API, and database connection existing before any feature-specific code can be written. Without this spec, each feature spec would have to reinvent project setup inconsistently.

**Why it matters now:** This is the first spec in build order (index #1). Nothing else in Phase 1 can start until a coding agent can run the frontend, run the backend, and connect both to a real Postgres database locally.

**Success looks like:** A developer clones the repo, follows `README.md`, and within one `npm install` + `npm run dev` per app has a Next.js page rendering at `localhost:3000` that successfully calls an Express health-check endpoint at `localhost:4000`, which in turn confirms a live Prisma connection to Postgres.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a fresh clone **When** the developer runs `npm install` in `frontend/` and `backend/` **Then** both install without error using the versions pinned in each `package.json` |
| AC-2 | **Given** the backend is running with a valid `DATABASE_URL` **When** `GET /api/health` is called **Then** it returns `200` with `{ "status": "ok", "database": "connected" }` |
| AC-3 | **Given** the backend is running with an invalid/unreachable `DATABASE_URL` **When** `GET /api/health` is called **Then** it returns `503` with `{ "status": "degraded", "database": "unreachable" }` and does not crash the process |
| AC-4 | **Given** the frontend dev server is running **When** a browser loads `/` **Then** it renders the shared dark/glassmorphism base layout (SRS §21) with no console errors, proving Tailwind, fonts, and the App Router are wired correctly |
| AC-5 | **Given** a developer runs `npm run lint`, `npm run typecheck`, and `npm run test` from the repo root **Then** all three succeed against the empty/scaffolded codebase (no feature code yet, so this proves the tooling itself is correctly configured) |
| AC-6 | **Given** `.env.example` in both `frontend/` and `backend/` **Then** every environment variable referenced anywhere in the codebase has a corresponding documented entry with no real secret values |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/health` | none | `200` `{ status, database }` | Never cached; used by uptime checks later (Phase 3 §34.2) |

### Request and response DTOs

```ts
// backend/src/types/health.ts
export interface HealthResponse {
  status: "ok" | "degraded";
  database: "connected" | "unreachable";
  uptimeSeconds: number;
}
```

No request body. No auth required — this endpoint must work even when every other subsystem is down, since its purpose is to report that.

### Error codes

No error-code envelope applies to this endpoint (it always returns `200` or `503` with the shape above). The standard error envelope used by every *other* endpoint in this project, starting with Spec 2, is:

```ts
export interface ApiError {
  code: string;       // SCREAMING_SNAKE_CASE, stable forever
  message: string;    // human-readable, safe to show a user
  details?: Record<string, string[]>; // field -> validation messages
}
```

### Breaking-change check

- [x] N/A — first version of this endpoint, nothing to break yet.

---

## 4. Data model changes

None. This spec only establishes the Prisma toolchain and its connection to Postgres (`prisma init`, `schema.prisma` with the `datasource`/`generator` blocks and zero models). The first real models are defined in `02-vehicle-catalog-data-model.md` (Spec 2).

### Migration

- **Name:** none yet — no models to migrate.
- **Reversible:** N/A
- **Backfill required:** no
- **Downtime:** none
- **Reviewed SQL:** N/A

### Retention and privacy

N/A — no data stored by this spec.

---

## 5. UI states

This spec ships the shared application shell only, not a feature screen, so the four-state table doesn't apply per-screen yet. It establishes the tokens every later spec's UI states must use:

| Token | Value |
|---|---|
| Background | near-black (`#0a0a0c` or equivalent Tailwind custom color), never pure `#000` |
| Panel surface | glassmorphism: translucent dark fill, `backdrop-blur`, 1px subtle border at low opacity |
| Typography | large display headline font for hero/section titles, a neutral sans for body/UI |
| Motion | Framer Motion + GSAP both available; respect `prefers-reduced-motion` globally (SRS §29) — this spec wires the media-query check into a shared hook (`useReducedMotion`), later specs must consume it rather than re-detecting it |

**Route(s):** `/` (placeholder shell page only — real landing page content is Spec 4)
**Directory:** `frontend/` (Next.js app), `backend/` (Express API)

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | health-check handler branches (DB up/down) | `backend/tests/health.test.ts` (Vitest) |
| **Integration** | `GET /api/health` round trip against a real test Postgres instance | `backend/tests/integration/health.int.test.ts` |
| **Component** | shell layout renders without error, respects reduced-motion flag | `frontend/tests/layout.test.tsx` (Vitest + React Testing Library) |
| **E2E** | none yet — deferred until a real user journey exists (Spec 4 onward) | `frontend/e2e` (Playwright, configured but no specs yet) |

**Traceability**

| AC | Test |
|---|---|
| AC-2, AC-3 | `health.int.test.ts` |
| AC-4 | `layout.test.tsx` |
| AC-1, AC-5, AC-6 | verified by CI running the commands directly, not a unit test |

**Coverage:** not enforced yet — the ≥80% gate (per template default) starts applying from Spec 2 onward, once there is feature logic to measure.

**Not covered, deliberately:** visual regression testing — no design system exists yet to regress against.

---

## 7. Out of scope

- Any actual Vehicle/Configuration data or endpoints (Spec 2).
- Authentication of any kind (Phase 2).
- CI/CD pipeline automation (Phase 3, §34.2) — this spec only makes the lint/typecheck/test/build commands work locally; wiring them into a CI provider is a separate, later spec.
- Deployment to Vercel/Render (§24) — local dev only.
- Any 3D rendering — Three.js/React Three Fiber/Drei are installed as dependencies here so later specs don't repeat setup, but no `<Canvas>` is rendered by this spec.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Next.js was substituted for the SRS's originally specified Vite to support per-build OG images (Phase 3, §34.3) | Product owner | Resolved — accepted trade-off, recorded in `docs/specs/README.md` |
| 2 | Package manager choice (npm vs pnpm vs yarn) not specified anywhere | Product owner | Open — defaulting to npm since the SRS's architecture diagram (§25) shows a single root `package.json`; revisit if monorepo tooling (Turborepo/Nx) is wanted later |
| 3 | Node.js LTS version to target | Implementer | Open — default to the current Active LTS at implementation time; pin exactly in `package.json` `engines` |

---

## 9. Rollout

- **Feature flag:** none — foundational scaffold, not a toggleable feature.
- **Migration order:** N/A, no schema yet.
- **Rollback:** delete the scaffold; nothing depends on it existing except every later spec's `dev`/`build` commands.
- **Observability:** `/api/health` itself is the first observability primitive; later Phase 3 work (§34.2) wires it into real uptime monitoring.
