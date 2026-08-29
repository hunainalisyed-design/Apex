# Spec: Cinematic Landing Page

**File:** `docs/specs/04-landing-page.md`
**Status:** Approved
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §3 (Landing Page); depends on `01-project-foundation.md`

---

## 1. Problem statement

**Today:** No page exists beyond the placeholder shell from Spec 1. The SRS's entire premise — "feels like a futuristic luxury automotive website" — is set by the very first thing a visitor sees, so this is the highest-leverage single screen in the product.

**Who is affected:** Every visitor, on every device, on first load.

**Why it matters now:** It is the entry point of the user journey (SRS §2: Landing Page → Explore Cars → …) and the first proof that the "no fake interactions" rule (SRS §32) is being honored — the hero vehicle must be a real, interactive 3D model from the first frame the user can touch it, not a video or static render standing in for one.

**Success looks like:** A first-time visitor sees a dark cinematic hero with a real 3D vehicle, watches a short reveal sequence play once, and can immediately act on "Configure Your Car" or "Explore Models" without waiting for anything else to load.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a first visit to `/` **When** the page finishes loading **Then** the hero plays, in order: background fade-in → vehicle reveal → camera move-in → headline reveal → CTA reveal → idle rotation begins, matching SRS §3's sequence |
| AC-2 | **Given** the hero animation is mid-sequence **When** the user clicks "Configure Your Car" or "Explore Models" **Then** navigation proceeds immediately — the reveal sequence never blocks or delays a user-initiated action |
| AC-3 | **Given** `prefers-reduced-motion` is set **When** the page loads **Then** the vehicle and headline appear directly in their final state with a single simple cross-fade, with no camera fly-in or staged reveal (SRS §29) |
| AC-4 | **Given** the 3D hero model is still downloading **When** the page is first painted **Then** the headline, subheading, and both CTAs are visible and interactive immediately — they do not wait on the 3D asset (SRS §26: progressive loading) |
| AC-5 | **Given** the hero model fails to load (network error or unsupported WebGL) **When** this is detected **Then** the hero area shows the static fallback state defined in Spec 12 (Loading/Error/A11y Shell) instead of an empty or broken canvas — the headline and CTAs remain usable regardless |
| AC-6 | **Given** "Configure Your Car" is clicked **When** navigation completes **Then** the user lands on the model-selection entry point owned by Spec 5 (3D Showroom Core) |
| AC-7 | **Given** the page is viewed on a touch device **When** the user drags on the hero vehicle **Then** it responds with a subtle rotation, previewing the full interaction Spec 5 provides in the showroom, without implementing showroom-grade camera controls here |

---

## 3. API contract

No new backend endpoints. This page reads exactly one vehicle for the hero (the featured vehicle — Apex GT, per SRS §6 being listed first) via the existing `GET /api/vehicles/:slug` from Spec 2. No write operations occur on this page.

### Breaking-change check

- [x] N/A — no new contract.

---

## 4. Data model changes

None. Reads `Vehicle.heroModelUrl`, `name`, `tagline` from Spec 2's existing schema.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | headline/subheading/CTAs render immediately (SSR via Next.js); hero 3D canvas shows a subtle placeholder glow/gradient (not a spinner) until the GLB streams in, per SRS §26 |
| **Empty** | not applicable — this page always has content to show (it is not data-driven beyond one featured vehicle) |
| **Error** | 3D load failure → static hero fallback per Spec 12; headline/CTAs unaffected; a small non-blocking notice ("3D preview unavailable") is not shown unless the user opens dev tools — this is a graceful degrade, not a user-facing error per SRS §28's guidance to keep 3D errors low-friction |
| **Success** | full cinematic sequence as in AC-1; idle rotation continues indefinitely until the user navigates away or interacts |

Also specify:
- **Validation:** none — no form inputs on this page.
- **Keyboard/screen-reader:** both CTAs are real `<a>`/`<button>` elements reachable by Tab, with visible focus rings; the hero canvas is `aria-hidden` with the vehicle name/tagline conveyed via the adjacent headline text, not the canvas.
- **Responsive:** desktop shows the full-bleed hero with headline overlaid; mobile stacks the vehicle above a shorter headline and full-width CTAs, per SRS §27's general desktop/mobile split.
- **Permission-gated content:** none — this page requires no auth and shows identically to every visitor (SRS §36.5 guest mode applies to the whole product, not just this page).

**Route(s):** `/`
**Directory:** `frontend/src/app/page.tsx` (Next.js App Router), `frontend/src/components/landing/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | reveal-sequence state machine (fade → reveal → camera → headline → CTA → idle) advances correctly and is skippable | `frontend/tests/landing/heroSequence.test.ts` |
| **Component** | reduced-motion path renders final state directly; loading state shows placeholder not spinner; error path renders Spec 12's fallback | `frontend/tests/landing/Hero.test.tsx` |
| **E2E** | first visit → sees headline within budget → clicks "Configure Your Car" → arrives at model selection | `frontend/e2e/landing.spec.ts` (Playwright) |

**Traceability**

| AC | Test |
|---|---|
| AC-1, AC-3 | `heroSequence.test.ts` |
| AC-2, AC-6 | `landing.spec.ts` |
| AC-4, AC-5 | `Hero.test.tsx` |
| AC-7 | `landing.spec.ts` touch-emulation case |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** pixel-perfect animation timing/easing — verified visually during implementation review, not asserted in tests.

---

## 7. Out of scope

- The "Explore Models" grid/list content itself and vehicle selection — owned by Spec 5 (3D Showroom Core), which this page only links to.
- Scroll-triggered section transitions further down the page — owned by Spec 13 (Navigation & Scroll Shell), since SRS §23's full scroll sequence spans multiple sections beyond the hero.
- SEO meta tags / Open Graph — Phase 3 (§34.3).

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Depends on the placeholder 3D asset decision flagged as open in Spec 2, Risk #1. | Product owner | Open — same resolution needed before implementation. |
| 2 | Exact headline/subheading copy — SRS §3 gives examples ("BUILD YOUR VISION.") rather than final copy. | Product owner | Resolved for Phase 1 — use the SRS's example copy verbatim; revisit with real marketing copy later without needing a spec change. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A.
- **Rollback:** revert to Spec 1's placeholder shell.
- **Observability:** track hero-load success/failure rate and time-to-interactive for the CTAs (not the 3D asset) once Phase 3 analytics (§34.3) exists; not required for Phase 1 launch.
