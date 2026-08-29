# Spec: Loading, Error & Accessibility Shell

**File:** `docs/specs/12-loading-error-a11y-shell.md`
**Status:** Approved
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §26 (Performance Requirements), §27 (Responsive Design), §28 (Error Handling), §29 (Accessibility); depends on `01-project-foundation.md` (`useReducedMotion`), `02-vehicle-catalog-data-model.md`

---

## 1. Problem statement

**Today:** Specs 4, 5, 9, 10, and 11 each reference shared infrastructure that doesn't exist yet as real code — a showroom loading screen, a 3D error fallback, an error-message mapping from API `code`s to human text, and a toast system. Those specs were written assuming this spec would deliver them, since duplicating this plumbing per-feature would both violate SRS §28/§29's requirements inconsistently and contradict the "one place, reused everywhere" pattern already established for the configuration store (Spec 6) and pricing (Spec 3).

**Who is affected:** Every user, on every screen — a missing loading or error state is called out explicitly in the reference spec template as "an incomplete feature, not a follow-up ticket," and SRS §29 requires reduced-motion, keyboard, and screen-reader support product-wide, not per-screen.

**Why it matters now:** Several already-approved specs (4, 5, 9, 10, 11) cite this spec by name for pieces they don't implement themselves. This spec is what makes those citations true.

**Success looks like:** No screen in the product ever shows a blank white page, an unhandled JS error, a raw stack trace, or an unreachable-by-keyboard control — and a user with `prefers-reduced-motion` set gets a calmer, equally functional experience automatically.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** WebGL is unavailable or the context is lost **When** the landing hero (Spec 4) or showroom (Spec 5) would otherwise render a 3D canvas **Then** both instead render `<Static3DFallback>`, showing the vehicle's `fallbackImageUrl` still image plus its name and spec sheet as text — never an empty canvas or a broken-looking gap |
| AC-2 | **Given** a vehicle's GLB is downloading **When** the showroom mounts **Then** `<ShowroomLoadingScreen>` shows "INITIALIZING SHOWROOM..." with a determinate progress bar driven by the loader's real download progress, and disappears with no layout shift once the model is ready (SRS §26) |
| AC-3 | **Given** an unexpected JavaScript error occurs anywhere in the render tree **When** it propagates **Then** `<AppErrorBoundary>` catches it and shows a generic, human-readable recovery screen with a reload action — never a blank page and never a raw stack trace (SRS §28) |
| AC-4 | **Given** an API call fails with a known error `code` (from Specs 2, 3, 10, or the future AI spec) **When** the failure is surfaced to the user **Then** `getErrorMessage(code)` maps it to one of the SRS §28-style human messages (e.g. `VEHICLE_NOT_FOUND` → "Unable to load vehicle. Please try again.", `CONFIGURATION_NOT_FOUND` → "This build could not be found."); any `code` without an explicit mapping falls back to a generic "Something went wrong. Please try again." — the raw `code` or `message` string is never shown to the user |
| AC-5 | **Given** any animated transition anywhere in the app (camera moves, hero reveal, panel transitions) **When** it is implemented using the shared `withReducedMotion(animate, instant)` wrapper **Then** it automatically plays `instant` instead of `animate` when `useReducedMotion()` (Spec 1) is true, with no per-call-site reduced-motion branching logic duplicated |
| AC-6 | **Given** any page in the app **When** a keyboard user presses Tab as their very first action **Then** a visually-hidden-until-focused "Skip to main content" link appears and, when activated, moves focus past the navigation/hero chrome to the page's main content |
| AC-7 | **Given** any interactive control anywhere in the app **When** it receives keyboard focus **Then** it shows a visible focus ring meeting WCAG 2.1 AA contrast, via the shared `:focus-visible` utility class defined by this spec — individual feature specs (6, 7, 8, 9, 10, 11) apply this class rather than defining their own focus styling |
| AC-8 | **Given** any part of the app needs to show a transient confirmation or error (Spec 9's price-change notice, Spec 10's copy confirmations, Spec 11's capture error) **When** it calls the shared `useToast()` hook **Then** the toast appears via one `<ToastProvider>`, is `aria-live="polite"` for confirmations and `aria-live="assertive"` for errors, auto-dismisses after a reasonable duration, and remains manually dismissible |
| AC-9 | **Given** the app is viewed on desktop vs. mobile **When** any panel-bearing screen (Spec 5's showroom, Specs 6–9's panels) renders **Then** it uses the shared `<ShowroomLayout>` primitive, which places 3D content left / panel right above a breakpoint and 3D content top / controls below beneath it (SRS §27) — individual specs don't redefine this breakpoint logic |

---

## 3. API contract

No new backend endpoints. This spec is entirely frontend infrastructure, though it does define the canonical shape every backend error response must already conform to (the `ApiError` envelope was established in Spec 1 — this spec is the first to actually consume `code` uniformly on the frontend).

### Breaking-change check

- [x] N/A — no new contract.

---

## 4. Data model changes

### Entities

| Entity | Change | Fields |
|---|---|---|
| `Vehicle` (from Spec 2) | modified | add `fallbackImageUrl: String` (required — every vehicle must ship a static fallback image, not an optional nicety) |

### Migration

- **Name:** `AddFallbackImageUrlToVehicle`
- **Reversible:** yes — drop the column (would break AC-1's fallback path, but is a clean reversal).
- **Backfill required:** yes, trivially — both seeded vehicles (Spec 2) need a `fallbackImageUrl` set; since Spec 2's seed data predates this requirement, this migration's seed update is additive to Spec 2's seed script, not a new one.
- **Downtime:** none.
- **Reviewed SQL:** to be pasted once generated.

### Retention and privacy

No change — `fallbackImageUrl` is non-personal catalog data.

---

## 5. UI states

This spec *is* the UI-states infrastructure other specs consume, so its own "states" are the shared components themselves:

| Component | Behaviour |
|---|---|
| `<ShowroomLoadingScreen>` | full-screen, dark, "INITIALIZING SHOWROOM..." with determinate progress (AC-2) |
| `<Static3DFallback>` | still image + name + spec sheet text, styled consistently with the rest of the showroom chrome (AC-1) |
| `<AppErrorBoundary>` | generic recovery screen, reload action, no technical detail exposed (AC-3) |
| `<ToastProvider>` / `useToast()` | stacked, dismissible, `aria-live`-appropriate notifications (AC-8) |
| `<ShowroomLayout>` | responsive left/right ↔ top/bottom composition primitive (AC-9) |

Also specify:
- **Validation:** none — this spec has no forms.
- **Keyboard/screen-reader:** AC-6 and AC-7 are this spec's core deliverable; every other spec's "visible focus ring" and "keyboard operable" acceptance criteria are satisfied by consuming this spec's utilities, not by independent implementation.
- **Responsive:** AC-9's `<ShowroomLayout>` is the single source of truth for the desktop/mobile split described throughout Specs 3–11.
- **Permission-gated content:** none — this infrastructure applies identically regardless of auth state.

**Route(s):** none of its own — consumed by every route.
**Directory:** `frontend/src/components/shell/`, `frontend/src/lib/errors/getErrorMessage.ts`, `frontend/src/lib/motion/withReducedMotion.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | `getErrorMessage` mapping table, including the unmapped-code fallback | `frontend/tests/lib/errors.test.ts` |
| **Unit** | `withReducedMotion` dispatches `instant` vs. `animate` correctly based on `useReducedMotion()` | `frontend/tests/lib/motion.test.ts` |
| **Component** | `<ShowroomLoadingScreen>`, `<Static3DFallback>`, `<AppErrorBoundary>`, `<ToastProvider>` each render and behave correctly in isolation | `frontend/tests/shell/*.test.tsx` |
| **E2E** | keyboard-only pass: Tab reveals skip link, activating it moves focus to main content, every configurator control remains reachable and shows a focus ring | `frontend/e2e/accessibility.spec.ts` |
| **E2E** | simulate WebGL unavailability (mock context creation failure) → assert `<Static3DFallback>` renders on both landing and showroom | `frontend/e2e/webgl-fallback.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1 | `webgl-fallback.spec.ts` |
| AC-2 | `ShowroomLoadingScreen.test.tsx` |
| AC-3 | `AppErrorBoundary.test.tsx` |
| AC-4 | `errors.test.ts` |
| AC-5 | `motion.test.ts` |
| AC-6, AC-7 | `accessibility.spec.ts` |
| AC-8 | `ToastProvider.test.tsx` |
| AC-9 | `ShowroomLayout.test.tsx` (breakpoint behavior) |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** a full automated axe/WCAG audit across every screen — recommended as a Phase 3 CI addition (§34.2) once more screens exist; this spec's E2E pass covers the keyboard/focus baseline manually specified in AC-6/AC-7.

---

## 7. Out of scope

- Any feature-specific loading/empty/error content (e.g. Spec 10's "This build could not be found" copy) — those specs own their own message text; this spec owns the mechanism (`getErrorMessage`, toast, error boundary) they're built on.
- Automated accessibility auditing tooling/CI integration — Phase 3 (§34.2).
- Server-side error logging/monitoring — Phase 3 (§34.2); this spec only ensures errors are handled gracefully client-side.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | This spec is sequenced #12 in the build order, but Specs 4, 5, 9, 10, and 11 (sequenced earlier) already reference its components by name. | Product owner | Resolved — this is intentional and acceptable for infrastructure specs: the index's build-order table already notes 4–13 "can mostly proceed in parallel," and this spec's components have no dependency on those feature specs' own logic, only the reverse. Implementers should build this spec's shared components before or alongside Specs 4/5, regardless of the index numbering. |
| 2 | `fallbackImageUrl` requires a real static render of each vehicle, which depends on the same placeholder-3D-asset decision blocking Specs 2/4/5/6/7 (Spec 2 Risk #1) — a still image can be produced from whatever placeholder GLB is chosen, so this isn't an additional blocker, just the same one. | Product owner | Open — tracked jointly with Spec 2 Risk #1, not a new independent blocker. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** the `fallbackImageUrl` migration should land alongside or immediately after Spec 2's initial migration, since AC-1 depends on it existing before the landing page or showroom ship.
- **Rollback:** revert the migration and remove the shared shell components; every consuming spec would need its own ad-hoc loading/error handling to remain functional, which is why rollback of this spec specifically is discouraged once Specs 4+ are implemented.
- **Observability:** `<AppErrorBoundary>` and `getErrorMessage`'s fallback path are natural instrumentation points for Phase 3 error monitoring (§34.2, e.g. Sentry) — this spec should log to `console.error` in the meantime so failures are at least visible in development.
