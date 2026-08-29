# Spec: Asset Versioning & CDN Strategy

**File:** `docs/specs/25-asset-versioning-cdn.md`
**Status:** Draft
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §34.5 (Resilience for the 3D Experience — asset versioning); depends on `02-vehicle-catalog-data-model.md`, `21-admin-cms-panel.md`

---

## 1. Problem statement

**Today:** `Vehicle.heroModelUrl`/`showroomModelUrl` and every `CustomizationOption.assetRef` point at fixed URLs. Once Spec 21's Admin panel lets someone update a vehicle's 3D asset, overwriting the file at an existing URL would silently change what every previously-shared `Configuration` link (Spec 10) renders — including builds whose whole point was to look a specific way when shared. (Spec 12's WebGL-unavailable fallback is already handled separately, in Phase 1; this spec covers the asset-update side of §34.5, not capability detection.)

**Who is affected:** Anyone who shared a build link before an asset update; anyone experiencing slow 3D load times without CDN caching.

**Why it matters now:** It's the natural follow-up once Spec 21 makes asset URLs editable — without this spec, that capability is a foot-gun.

**Success looks like:** An admin updates a vehicle's model; existing shared links keep rendering exactly as they did when shared; new visits get the updated asset with proper long-lived caching.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** any GLB/GLTF/image asset URL used anywhere in the catalog **When** referenced **Then** it is content-addressed (a hash or version segment in the path, e.g. `.../apex-gt-showroom.a1b2c3d4.glb`) rather than a stable filename that gets overwritten in place |
| AC-2 | **Given** an admin updates a vehicle's model via Spec 21 **When** saved **Then** a *new* versioned URL is stored on the `Vehicle` row — the old file at the old URL is never deleted or overwritten, so it remains resolvable |
| AC-3 | **Given** a versioned asset URL **When** served **Then** it carries `Cache-Control: public, max-age=31536000, immutable` — safe because the URL itself changes whenever the content does (AC-1) |
| AC-4 | **Given** a previously-saved `Configuration` (Spec 10) whose vehicle's asset URLs have since changed **When** it is loaded via its `publicId` **Then** it renders using whatever asset URLs were current *at load time* on the `Vehicle`/`CustomizationOption` rows (not a historical snapshot) — this spec does **not** pin old configurations to old assets; see Risk #1 for why and its limits |
| AC-5 | **Given** old, superseded asset versions **When** no `Vehicle`/`CustomizationOption` row references them anymore **Then** they are eligible for cleanup by a periodic job, not deleted immediately (grace period, e.g. 30 days, in case of rollback) |

---

## 3. API contract

No new application endpoints — this is a storage/URL policy applied within Spec 21's admin write paths.

---

## 4. Data model changes

None beyond what already exists — `Vehicle.heroModelUrl`/`showroomModelUrl` and `CustomizationOption.assetRef` already store arbitrary strings (Spec 2); this spec is a *policy* for what those strings look like and how they're managed, not a schema change.

---

## 5. UI states

Not applicable — no direct UI beyond what Spec 21 already provides for uploading/setting asset URLs.

**Route(s):** none.
**Directory:** `backend/src/services/assets/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | version-hash generation is deterministic per content, changes when content changes | `backend/tests/assets/versioning.test.ts` |
| **Integration** | updating a vehicle's asset via Spec 21 produces a new URL without touching the old one; a `Configuration` saved before the update still loads (per AC-4's current-state semantics) without erroring | `backend/tests/integration/assets.int.test.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- True historical pinning (a saved build always looking pixel-identical to how it looked when shared, even after every future asset update) — see Risk #1; this is a real limitation, not solved by this spec.
- CDN provider selection — an infrastructure/hosting detail (whatever the hosting platform's default CDN or asset storage provides, e.g. Vercel's asset optimization, an S3+CloudFront setup, or Cloudinary) left to implementation.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | AC-4 means a shared build link can visually drift if the vehicle's assets are updated later (e.g. a new wheel model replaces an old one referenced by a saved selection's `assetRef` in spirit, even though the id is the same). True pinning would require storing a full asset-version snapshot per `Configuration`, which is significant added complexity for a scenario (assets changing after initial launch) unlikely to matter much for a portfolio project with a small, mostly-static catalog. | Product owner | Resolved — accepted limitation for now; document it plainly rather than silently having shared links possibly look different later. Revisit with true snapshotting only if the catalog becomes large/frequently updated. |

---

## 9. Rollout

- **Feature flag:** none — a storage policy, not a toggle.
- **Migration order:** should land before or alongside Spec 21, since Spec 21's write endpoints are what would otherwise violate this policy by construction.
- **Rollback:** N/A — this is a discipline/policy spec; there's no code to roll back beyond the versioning helper itself, which is harmless if unused.
- **Observability:** log every asset-version change (old URL → new URL) for traceability.
