# Spec Index — Virtual Car Configurator

Source of truth for scope: [`Virtual car configurator spec · MD`](../../Virtual%20car%20configurator%20spec%20%C2%B7%20MD) (the SRS).
Template for new specs: [`TEMPLATE - SPEC.md`](../../TEMPLATE%20-%20SPEC.md).

Foundational decisions locked in before Phase 1 specs were written:

| Decision | Choice | Reason |
|---|---|---|
| Database | PostgreSQL + Prisma | Relational integrity for users, pricing, reservations; SRS §12 requires pricing state can never go inconsistent. |
| AI provider | Claude API | Structured/tool-use output to constrain CarAI to catalog-valid options only (SRS §14). |
| Frontend framework | Next.js (React) | SRS §24 specified Vite, but SRS §34.3 requires per-build dynamic Open Graph images, which a client-only SPA cannot produce. Next.js keeps everything else in §24 (Three.js, React Three Fiber, Drei, Tailwind, GSAP, Framer Motion) unchanged. |
| Backend | Node.js + Express (unchanged from §24) | Kept separate from the Next.js app per §25's architecture; Next.js calls it as an API. |
| Phasing | Core-first | 3D + customization + pricing + save/share must work before AI, auth, or business/trending extras are attempted. |

Status values: **Backlog** (not yet spec'd) → **Draft** → **Approved** → **Implemented** → **Superseded**.

## Phase 1 — Core experience (guest mode, no auth required)

| # | Spec file | SRS section(s) | Status |
|---|---|---|---|
| 1 | `01-project-foundation.md` | §24, §25 | Implemented |
| 2 | `02-vehicle-catalog-data-model.md` | §6, §7, §10, §12 (entities) | Implemented |
| 3 | `03-dynamic-pricing-engine.md` | §12 | Implemented |
| 4 | `04-landing-page.md` | §3 | Implemented |
| 5 | `05-3d-showroom-core.md` | §4, §5 | Implemented |
| 6 | `06-exterior-customization.md` | §7, §8, §9 | Implemented |
| 7 | `07-interior-customization.md` | §10 | Implemented |
| 8 | `08-accessories-packages.md` | §11 | Implemented |
| 9 | `09-build-summary.md` | §17 | Implemented |
| 10 | `10-save-share-configuration.md` | §18 | Implemented |
| 11 | `11-screenshot-capture.md` | §19 | Implemented |
| 12 | `12-loading-error-a11y-shell.md` | §26, §27, §28, §29 | Implemented |
| 13 | `13-navigation-scroll-shell.md` | §22, §23 | Implemented |

Build order follows the table: 1–3 are shared foundations every later spec depends on; 4–13 can mostly proceed in parallel once 1–3 land, except 6/7/8 depend on 3, and 9/10/11 depend on 6/7/8.

## Phase 2 — AI, accounts, comparison

| # | Spec file | SRS section(s) | Status |
|---|---|---|---|
| 14 | `14-ai-configuration-backend.md` | §13, §14, §16 | Implemented |
| 15 | `15-carai-assistant-ui.md` | §15 | Implemented |
| 16 | `16-authentication.md` | §36.1–36.3, §36.5–36.6 | Approved |
| 17 | `17-account-dashboard-my-garage.md` | §36.4 | Approved |
| 18 | `18-car-comparison.md` | §20 | Approved |

## Phase 3 — Business, hygiene, compliance & trending features

All 19 specs below are written (Draft) and awaiting review/approval as a batch.

| # | Spec file | SRS section(s) | Status |
|---|---|---|---|
| 19 | `19-lead-capture-quote-request.md` | §34.1 | Draft |
| 20 | `20-reservation-deposit.md` | §34.1 | Draft |
| 21 | `21-admin-cms-panel.md` | §34.1 | Draft |
| 22 | `22-cicd-monitoring-logging.md` | §34.2 | Draft |
| 23 | `23-seo-og-analytics.md` | §34.3 | Draft |
| 24 | `24-cookie-consent-gdpr.md` | §34.4 | Draft |
| 25 | `25-asset-versioning-cdn.md` | §34.5 | Draft |
| 26 | `26-i18n-api-docs.md` | §34.6 | Draft |
| 27 | `27-ar-view-in-driveway.md` | §35.1 | Draft |
| 28 | `28-dynamic-environments.md` | §35.1 | Draft |
| 29 | `29-sound-design.md` | §35.1 | Draft |
| 30 | `30-shareable-video-clip.md` | §35.1 | Draft |
| 31 | `31-public-gallery.md` | §35.2 | Draft |
| 32 | `32-rarity-achievement-badges.md` | §35.2 | Draft |
| 33 | `33-live-collaborative-build.md` | §35.2 | Draft |
| 34 | `34-voice-driven-carai.md` | §35.3 | Draft |
| 35 | `35-ai-concept-renders.md` | §35.3 | Draft |
| 36 | `36-before-after-slider.md` | §35.4 | Draft |
| 37 | `37-drive-it-mini-mode.md` | §35.4 | Draft |

Build-order notes: 19→20→21 (leads, then reservations, then the admin panel that manages both) should land in that order; 25 (asset versioning) should land before or alongside 21, since 21's write endpoints are what it constrains; 24 (GDPR/consent) should land before or alongside 23 (analytics), since 23's tracking is gated on 24's consent state; 31 (gallery) depends on 16 (auth) and 11 (capture); 33 (live collaboration) is the single largest and highest-risk item in the whole backlog — see its own Risk #1 on hosting/infrastructure implications, and it is the first spec anyone should consider cutting if time runs short.

Two open cross-spec decisions surfaced while writing this batch, not yet resolved:
- **Spec 35** (AI concept renders) needs a separate paid image-generation API vendor chosen — deliberately left open rather than decided unilaterally, since it's a new paid third-party relationship distinct from the already-decided Claude API.
- **Spec 23** (analytics) needs a specific provider chosen (recommended: something privacy-friendly/cookie-light, to keep Spec 24's consent gating simple) — left as an implementation detail, not product-significant enough to block approval.
