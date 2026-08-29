# Spec: Navigation & Scroll-Driven Transitions

**File:** `docs/specs/13-navigation-scroll-shell.md`
**Status:** Approved
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §22 (Navigation), §23 (Scroll Animations); depends on `02-vehicle-catalog-data-model.md`, `04-landing-page.md`, `05-3d-showroom-core.md`, `12-loading-error-a11y-shell.md` (`withReducedMotion`, skip link)

---

## 1. Problem statement

**Today:** Specs 4 and 5 exist as standalone routes (`/`, `/models`, `/configure/[slug]`) with no shared navigation chrome connecting them, and the landing page's cinematic ambition (SRS §23's six-stage scroll sequence) stops at the hero (Spec 4 explicitly deferred it here).

**Who is affected:** Every user moving between sections of the site, and every visitor scrolling past the landing page's hero expecting the cinematic buildup SRS §23 describes.

**Why it matters now:** It's the last Phase 1 spec — everything it wires together (Home, Models, Configurator, About, plus the landing page's extended scroll showcase) already exists as individual routes/specs; this spec is what makes the product feel like one connected site rather than a set of disconnected pages.

**Success looks like:** A user can reach any working part of the product from a persistent, minimal nav bar on any screen size, and scrolling past the landing page's hero plays a cinematic, skippable showcase sequence that ends by inviting them into the real configurator.

---

## 2. Acceptance criteria

### Navigation

| # | Criterion |
|---|---|
| AC-1 | **Given** any page **When** the nav bar renders **Then** it shows working links to Home (`/`), Models (`/models`), Configurator (`/configure/{defaultVehicleSlug}`, the first active vehicle by `sortOrder`), and About (a minimal static page introducing the project) |
| AC-2 | **Given** Compare is not yet built (Phase 2, Spec 18) **When** the nav renders **Then** "Compare" appears visibly disabled with a "Coming Soon" affordance (e.g. a tooltip) rather than as a broken link or being silently omitted — the information architecture from SRS §22 is present even before every destination is functional |
| AC-3 | **Given** a viewport below the mobile breakpoint **When** the nav renders **Then** it collapses into a hamburger toggle that opens an animated (or, per reduced-motion, instantly-shown) full-screen or slide-in menu listing the same links |
| AC-4 | **Given** Phase 2 specs will add an AI Assistant control and an account area to the nav's right side (SRS §22, §36.6) **When** this spec's nav component is built **Then** it exposes an extensible right-side slot (e.g. a `NavRightSlot` render-prop or children area) so those specs add controls without restructuring this component |
| AC-5 | **Given** a keyboard-only user **When** they interact with the nav **Then** the hamburger toggle is a real button reachable via Tab, the mobile menu's items are focusable in order while open, and Escape closes an open mobile menu and returns focus to the toggle |
| AC-6 | **Given** the skip link from Spec 12 **When** activated **Then** focus moves to the page's main content, landing immediately after the nav's landmark region, not inside it |
| AC-7 | **Given** the current route **When** the nav renders **Then** the corresponding nav item carries `aria-current="page"` |

### Scroll-driven landing showcase

| # | Criterion |
|---|---|
| AC-8 | **Given** the landing page (Spec 4) below its hero **When** the user scrolls **Then** a six-stage cinematic sequence plays across the scroll range, matching SRS §23: vehicle established in the showroom → camera moves toward the exterior → camera focuses on the wheels → camera transitions to the interior → camera returns to the full vehicle → the configuration summary preview appears — reusing the hero's already-loaded vehicle GLB, never loading a second copy |
| AC-9 | **Given** normal scroll input **When** the user scrolls at any speed, including very fast **Then** the page never fights or hijacks the scroll — the user's own scroll position always remains in direct control; the sequence maps scroll progress to animation progress, it does not intercept or override scroll events |
| AC-10 | **Given** `prefers-reduced-motion` is set **When** the user reaches this section **Then** it renders as a simple static sequence of images and short captions covering the same six beats, with no scroll-driven camera animation |
| AC-11 | **Given** the end of the scroll sequence **When** reached **Then** a clear "Configure Your Car" CTA is shown, linking into `/configure/{slug}` (Spec 5) — mirroring the hero's own CTA (Spec 4, AC-2/AC-6) so the path into the real product is always obvious |
| AC-12 | **Given** a mobile viewport **When** the scroll sequence plays **Then** it adapts to a simpler stacked-image reveal rather than a full real-time camera orbit, to stay within SRS §26's mobile performance expectations |

---

## 3. API contract

No new endpoints. The Configurator nav link (AC-1) reads the same `GET /api/vehicles` list (Spec 2) already used by `/models` to determine the default vehicle's slug.

### Breaking-change check

- [x] N/A — no new contract.

---

## 4. Data model changes

None.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | nav renders immediately (it doesn't depend on vehicle data except for the Configurator link's target, which can resolve after first paint without blocking the rest of the nav) |
| **Empty** | not applicable |
| **Error** | if the vehicle list fails to load, the Configurator nav link falls back to pointing at `/models` instead of a specific vehicle, rather than being disabled |
| **Success** | full nav and, on the landing page, the scroll sequence, both function as described |

Also specify:
- **Validation:** none.
- **Keyboard/screen-reader:** covered by AC-5/AC-6/AC-7; the scroll sequence's content (vehicle name, captions) is also present as real DOM text (not canvas-only) so screen readers can access the same information a sighted scrolling user gets.
- **Responsive:** AC-3 (nav) and AC-12 (scroll sequence) are this spec's responsive requirements specifically; general panel layout responsiveness is Spec 12's `<ShowroomLayout>`.
- **Permission-gated content:** none in Phase 1 — the nav's right-side slot (AC-4) is where Phase 2's auth-gated account area will attach.

**Route(s):** nav appears on every route; the scroll sequence is specific to `/` (Spec 4).
**Directory:** `frontend/src/components/shell/Nav/`, `frontend/src/components/landing/ScrollShowcase/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | default-vehicle resolution for the Configurator link, including the fallback-to-`/models` error path | `frontend/tests/shell/navLinks.test.ts` |
| **Component** | nav renders all links, Compare shows disabled state, mobile menu opens/closes, `aria-current` reflects route | `frontend/tests/shell/Nav.test.tsx` |
| **Component** | scroll sequence's reduced-motion static fallback renders the same six beats as text/images | `frontend/tests/landing/ScrollShowcase.test.tsx` |
| **E2E** | keyboard pass through nav and mobile menu (Escape behavior included); scroll through the landing showcase at both normal and fast scroll speed and assert scroll position is never overridden | `frontend/e2e/navigation.spec.ts`, `frontend/e2e/scroll-showcase.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1, AC-2 | `Nav.test.tsx` |
| AC-3, AC-5 | `navigation.spec.ts` |
| AC-4 | `Nav.test.tsx :: right slot extensibility` |
| AC-6, AC-7 | `navigation.spec.ts` |
| AC-8, AC-11 | `scroll-showcase.spec.ts` |
| AC-9 | `scroll-showcase.spec.ts :: fast scroll never overrides position` |
| AC-10 | `ScrollShowcase.test.tsx` |
| AC-12 | `scroll-showcase.spec.ts` mobile-viewport variant |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** exact animation timing/easing for the scroll sequence — verified visually during implementation, consistent with how Spec 4's hero sequence is handled.

---

## 7. Out of scope

- The AI Assistant control and account area itself (SRS §22's right-side items, §36.6) — Phase 2 specs 15/16 attach to this spec's `NavRightSlot` (AC-4) rather than this spec building placeholder versions of features that don't exist yet.
- The actual Compare page (Phase 2, Spec 18) — this spec only reserves its place in the nav (AC-2).
- The About page's actual written content — a minimal placeholder page is in scope structurally (AC-1 needs a working link), but its copy is content work, not a code/spec concern.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | SRS §23's scroll sequence is ambiguous about where it lives — it could describe the landing page's post-hero content (this spec's reading) or a scroll-driven mode for the actual `/configure/[slug]` showroom itself. | Product owner | Resolved — placed on the landing page as a marketing/showcase sequence, explicitly *not* applied to the real configurator. Spec 5 already establishes the configurator's camera as drag/preset-button driven (AC-3/AC-5), and scroll-hijacking a page the user is actively trying to scroll past a customization panel on would conflict with ordinary page scroll and SRS §29's accessibility requirements. The landing page, which nobody is trying to "scroll past" a functional UI on, is the safe place for a scroll-driven camera showcase. |
| 2 | A scroll-linked camera sequence sharing the hero's loaded GLB (AC-8) needs the showroom's camera-preset math (Spec 5) to be reusable outside the interactive showroom context — worth confirming that logic was written generically enough during Spec 5's implementation. | Implementer | Open — a technical dependency check during implementation, not a product decision. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A — no schema.
- **Rollback:** remove the nav component (falling back to each page's own header, if any) and the scroll showcase section (landing page reverts to hero-only, its pre-Spec-13 state).
- **Observability:** none beyond what Spec 5/12 already provide.
