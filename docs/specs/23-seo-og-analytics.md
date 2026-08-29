# Spec: SEO, Dynamic Open Graph Images & Analytics

**File:** `docs/specs/23-seo-og-analytics.md`
**Status:** Draft
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §34.3 (SEO & Growth); depends on `10-save-share-configuration.md`, `09-build-summary.md`

---

## 1. Problem statement

**Today:** Every page renders with generic or absent metadata, and shared build links (Spec 10) all show the same non-descriptive preview when pasted into chat/social apps. This is the exact gap that justified swapping Vite for Next.js back in Spec 1 — SRS §34.3 wants a dynamic per-build Open Graph preview image, which requires server-side rendering.

**Who is affected:** Anyone sharing a build link; search engines indexing the product; whoever wants funnel data on how far visitors get.

**Why it matters now:** It's the payoff of an architectural decision made at the very start of Phase 1 — without this spec, that decision has no realized benefit yet.

**Success looks like:** Pasting a shared build link into any chat app shows that vehicle, its key options, and its price as a real preview image — not a generic site icon.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** any page **When** crawled or shared **Then** it has accurate `<title>`, meta description, and Open Graph/Twitter Card tags via Next.js's `generateMetadata` |
| AC-2 | **Given** a shared build URL (`/configure/{slug}?build={publicId}`) **When** its Open Graph image is requested **Then** a dynamically generated image (via Next.js's `ImageResponse`/`next/og`) renders the vehicle name, 2–3 key build-summary lines (Spec 9's `deriveBuildSummary`), and the total price — server-rendered per request, cached at the edge, not client-generated |
| AC-3 | **Given** the site root **When** requested **Then** `sitemap.xml` and `robots.txt` are served, listing all public routes (landing, models, vehicle configurators in default state, compare, about) — not user-specific saved-build URLs, which aren't meant for indexing |
| AC-4 | **Given** a vehicle's configurator page **When** rendered **Then** it includes `schema.org` structured data (`Vehicle`/`Product` type) with name, price, and image, improving rich-result eligibility |
| AC-5 | **Given** a user's cookie-consent choice (Spec 24) allows analytics **When** they move through the funnel (landing view → model selected → configuration started → saved → shared/quote-requested) **Then** each step fires an analytics event, letting drop-off be measured end to end |
| AC-6 | **Given** a user has not consented to analytics (Spec 24) **When** they use the app **Then** no analytics script loads or fires at all — this spec's tracking is fully gated by that consent decision, not merely hidden from a dashboard |

---

## 3. API contract

No new application endpoints beyond the OG image route Next.js generates internally (`/configure/[slug]/opengraph-image`).

---

## 4. Data model changes

None — this spec reads existing `Vehicle`/`Configuration` data (Specs 2, 10) and Spec 9's derivation logic; it stores no new data itself (analytics events go to whichever provider is chosen, not this app's own database).

---

## 5. UI states

Not applicable in the usual sense — this spec's "UI" is metadata and generated images, not interactive surfaces.

**Route(s):** metadata/OG generation attaches to all existing routes; no new user-facing routes.
**Directory:** `frontend/src/app/**/opengraph-image.tsx`, `frontend/src/lib/analytics.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | OG image content derivation (which summary lines are selected) — reuses Spec 9's own tested function | `frontend/tests/seo/ogImage.test.ts` |
| **Integration** | `sitemap.xml`/`robots.txt` contain expected routes and exclude build-specific URLs | `frontend/tests/seo/sitemap.test.ts` |
| **E2E** | fetch a shared build URL's OG image endpoint directly and assert it renders without error and includes the vehicle name as visible text (via image-to-text or a debug JSON mode) | `frontend/e2e/og-image.spec.ts` |
| **Component** | analytics events fire only when consent is granted (Spec 24) | `frontend/tests/analytics.test.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Choosing the specific analytics provider (Plausible, PostHog, Vercel Analytics, etc.) — an implementation detail with no product-behavior impact, left open (Risk #1).
- Paid search / ad campaign tracking — no advertising spend exists for this project.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Analytics provider not chosen. | Implementer | Open — recommend a privacy-friendly, cookie-light option (e.g. Plausible) to keep Spec 24's consent-gating simple, but not architecturally significant enough to block this spec. |
| 2 | Generating an OG image per request (rather than caching per `publicId`) could add latency to link-preview crawlers, some of which have short timeouts. | Implementer | Open — Next.js's edge caching should handle this for repeated fetches of the same `publicId`; worth a quick performance check during implementation. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A.
- **Rollback:** remove metadata generation and OG image routes; pages fall back to Next.js defaults.
- **Observability:** track OG-image generation failures (should never silently 500 for a crawler).
