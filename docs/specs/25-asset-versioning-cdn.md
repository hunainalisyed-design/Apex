# Spec: Asset Versioning & CDN Strategy

**File:** `docs/specs/25-asset-versioning-cdn.md`
**Status:** Implemented
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

### How each criterion is implemented

- **AC-1** — `backend/src/services/assets/versioning.ts`: a version is the first 8 hex chars of the file's sha256, inserted before the extension (`porsche-992-gt3-r.93062210.glb`). Hash and extension must be lowercase, matching the AC-3 header rule exactly. The Spec 21 admin write paths reject a *changed* `heroModelUrl`/`showroomModelUrl`/`thumbnailUrl`/`fallbackImageUrl` that isn't versioned (on create, all four must be). A value resent unchanged is accepted, so editing a pre-policy vehicle's name doesn't fail on its old placeholder URL.
- **AC-1 (`assetRef`)** — in the catalog, `assetRef` is a *key* the 3D layer interprets (`paint-obsidian-black`, `wheel-sport-20`), not a URL. The policy applies to it only when an admin sets it to an actual asset file URL (one with a GLB/GLTF/image extension).
- **AC-2** — files are published with `npm run assets:version -- <file> [subdir]` (backend), which copies the file into `frontend/public/<subdir>/` under its versioned name using an exclusive copy: it never overwrites or deletes, and refuses outright if a same-named file somehow has different bytes. The admin then pastes the printed URL into the Spec 21 form. Saving only rewrites the row's pointer.
- **AC-2 (rendering)** — the showroom, compare view and `/models` previews load the vehicle's own `showroomModelUrl`/`heroModelUrl` from the API. Before this spec they loaded a hardcoded path from `frontend/src/lib/showroom/realGlbVehicles.ts`, so an admin's URL change had no visible effect. That registry now holds only per-GLB tuning (paint material names, auto-fit length). `VehicleSummaryDto` gained both model URLs so list views can do this.
- **AC-3** — `frontend/next.config.ts` `headers()` matches `/<path>/<name>.<8 hex>.<glb|gltf|jpg|jpeg|png|webp|avif>` and sets `public, max-age=31536000, immutable`. Everything else keeps Next's `public/` default (`max-age=0`). Verified against a running server.
- **AC-4** — no change needed: saved builds already resolve their vehicle at load time; covered by an integration test that saves a build, swaps the model URL, and reloads it.
- **AC-5** — `npm run assets:gc` (backend) lists versioned files under `public/assets` and `public/models` that no `Vehicle`/`CustomizationOption` row references (active or not) and that were superseded more than 30 days ago (`--grace-days=N` to override). It is a dry run by default; `--delete` removes the eligible files. Unreferenced files with no recorded supersession are listed for manual review and never auto-deleted, and unversioned files are never candidates. It is a script, not an in-process job, because the files ship with the frontend deploy and the running backend can't delete them in production.

---

## 3. API contract

No new application endpoints — this is a storage/URL policy applied within Spec 21's admin write paths.

Changes to existing endpoints:
- `POST /api/admin/vehicles`, `PUT /api/admin/vehicles/:id`, `POST /api/admin/vehicles/:id/options`, `PUT /api/admin/options/:id` can now return `400 VALIDATION_ERROR` with message `"Asset URLs must be versioned."` and per-field `details` naming each offending URL field.
- `GET /api/vehicles` (summary list) now also returns `heroModelUrl` and `showroomModelUrl`.

### Error codes

No new codes — the existing `VALIDATION_ERROR` is reused.

---

## 4. Data model changes

None beyond what already exists — `Vehicle.heroModelUrl`/`showroomModelUrl` and `CustomizationOption.assetRef` already store arbitrary strings (Spec 2); this spec is a *policy* for what those strings look like and how they're managed, not a schema change.

Supersession history lives in the existing `AuditLogEntry` table (Spec 21): every changed asset URL writes an `asset.version_change` entry with `metadata: { field, oldUrl, newUrl }`. The cleanup job's grace period is measured from those entries.

Seed data: the four real-GLB vehicles' model files and all six thumbnails were renamed to versioned names, and their `showroomModelUrl` now points at the real model rather than a nonexistent `showroom.glb`.

**Documented exceptions (no file exists to version yet):** `apex-gt`/`apex-rs` `heroModelUrl`/`showroomModelUrl` and every vehicle's `fallbackImageUrl` keep their pre-policy placeholder paths. They're grandfathered, since the check applies only to URLs an admin changes, and should be replaced with versioned URLs when real files are produced.

---

## 5. UI states

Not applicable — no new screens beyond what Spec 21 already provides for setting asset URLs. The Spec 21 vehicle/option dialogs now show a save's per-field `details` inline on the matching field (`FormField` `errors`, as the Spec 16 auth forms do). Any detail without an inline field (e.g. `isDefault`) goes in the form-level banner via `frontend/src/lib/admin/saveErrorBanner.ts`.

**Route(s):** none.
**Directory:** `backend/src/services/assets/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | version-hash generation is deterministic per content, changes when content changes; versioned-URL detection; the admin validation rules; publishing never overwrites; cleanup selection honours references and the grace period | `backend/tests/assets/versioning.test.ts` |
| **Integration** | updating a vehicle's asset via Spec 21 produces a new URL without touching the old one; unversioned URLs are rejected; the change is audit-logged; a `Configuration` saved before the update still loads (per AC-4's current-state semantics) without erroring; cleanup eligibility against real DB references | `backend/tests/integration/assets.int.test.ts` |
| **Manual** | versioned files are served `immutable`, unversioned ones `max-age=0` | `curl -I` against `next dev` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- True historical pinning (a saved build always looking pixel-identical to how it looked when shared, even after every future asset update) — see Risk #1; this is a real limitation, not solved by this spec.
- CDN provider selection — an infrastructure/hosting detail (whatever the hosting platform's default CDN or asset storage provides, e.g. Vercel's asset optimization, an S3+CloudFront setup, or Cloudinary) left to implementation. The `Cache-Control` header set here is what any CDN in front of the frontend honours.
- An upload endpoint in the admin panel — publishing is a CLI step (`assets:version`), per §3's "no new endpoints".

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | AC-4 means a shared build link can visually drift if the vehicle's assets are updated later (e.g. a new wheel model replaces an old one referenced by a saved selection's `assetRef` in spirit, even though the id is the same). True pinning would require storing a full asset-version snapshot per `Configuration`, which is significant added complexity for a scenario (assets changing after initial launch) unlikely to matter much for a portfolio project with a small, mostly-static catalog. | Product owner | Resolved — accepted limitation for now; document it plainly rather than silently having shared links possibly look different later. Revisit with true snapshotting only if the catalog becomes large/frequently updated. |
| 2 | The landing-page hero (`HeroVehicleModel.tsx`) still hardcodes the Porsche's model URL: it's a brand visual rather than a catalog row, and it is preloaded at module load before any API data exists. | Engineering | Accepted — the constant points at the versioned file and is documented to be updated alongside the Porsche's `heroModelUrl`. Because old versions are never deleted immediately, a lag between the two never breaks the hero. |
| 3 | Integration tests share the dev database, and `assets:gc` reads whichever database `DATABASE_URL` points at. Running `--delete` against a database that doesn't match the deployed frontend's files could remove a file still referenced elsewhere. | Engineering | Mitigated — dry run by default, and only files with a recorded supersession older than the grace period are ever deleted. Run it against production data only. |

---

## 9. Rollout

- **Feature flag:** none — a storage policy, not a toggle.
- **Migration order:** should land before or alongside Spec 21, since Spec 21's write endpoints are what would otherwise violate this policy by construction. (Landed after Spec 21; existing rows were migrated via the seed rename above.)
- **Rollback:** N/A — this is a discipline/policy spec; there's no code to roll back beyond the versioning helper itself, which is harmless if unused. The initial rename means the old unversioned file paths (`/assets/models/<slug>.glb`, `/models/<slug>/thumbnail.jpg`) no longer resolve. Nothing referenced them externally — shared links go through `publicId` — so this is safe.
- **Observability:** every asset-version change (old URL → new URL) is logged via pino (`[assets] Asset version changed`) and recorded as an `asset.version_change` audit entry.
