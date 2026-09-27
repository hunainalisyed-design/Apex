# Spec: Rarity / Achievement Badges

**File:** `docs/specs/32-rarity-achievement-badges.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.2 (Rarity/achievement badges); depends on `09-build-summary.md`, `10-save-share-configuration.md`

---

## 1. Problem statement

**Today:** Nothing tells a user anything about how their choices compare to everyone else's. SRS §35.2 wants light gamification — "Only 3% of users chose this paint + wheel combo" — without cheapening the brand.

**Who is affected:** Users viewing their build summary or a saved build; a fun, low-stakes engagement hook.

**Why it matters now:** It's a small, self-contained addition that only needs aggregate statistics over existing `Configuration` data (Spec 10) — no new user input required.

**Success looks like:** A user sees a tasteful, factually accurate badge on their build summary when their combination is genuinely uncommon, and sees nothing when it isn't (no fabricated scarcity).

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a periodic aggregation job (not computed per-request) **When** it runs **Then** it computes, per vehicle, the count of each `(PAINT, WHEELS)` combination across all saved, unexpired `Configuration` rows (guest builds past their 90-day `expiresAt` aren't counted), and replaces the cached results in one transaction. It runs in the backend process about 10 seconds after startup and then every `RARITY_JOB_INTERVAL_MINUTES` (default 60; 0 disables it); `npm run rarity:compute` runs it once on demand |
| AC-2 | **Given** cached frequency data **When** a build summary (Spec 9) renders **Then** if the current build's `(PAINT, WHEELS)` combination is strictly under 5% of that vehicle's counted builds **and** the vehicle has at least 50 counted builds **then** a badge appears: "Only {X}% of {vehicle} builds choose this paint and wheel combination". It updates as paint/wheels change, without another request. A combination no one has saved shows no badge |
| AC-3 | **Given** the sample size is too small to be statistically meaningful (under 50 builds for the vehicle) **When** the build summary renders **Then** no badge is shown at all, rather than showing a misleadingly precise percentage from a handful of data points |
| AC-4 | **Given** the frequency data **When** computed **Then** the percentage shown is always genuinely accurate as of the last aggregation run — never a placeholder or fabricated. It's always shown with one decimal place, rounded **up** (3.41% shows as 3.5%), so it can never make a combination look rarer than it is; whether a combination qualifies is decided on the exact ratio, not the rounded one |
| AC-5 | **Given** a saved build is loaded (`?build=`) and its selections are unchanged **When** it is the earliest saved build (by creation time) with its `(PAINT, WHEELS)` combination, and the vehicle meets AC-3's minimum sample **Then** an achievement badge also appears: "First build ever with this paint and wheel combination". It is verifiable from the stored data at computation time, following the same accuracy requirement as AC-4 |

---

## 3. API contract

The aggregation is a scheduled backend job; its output is read by one public, read-only endpoint:

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/vehicles/:slug/combo-rarity` | none | `200` `ApiResponse<ComboRarityDto>` | optional `?build=<publicId>` for AC-5; `Cache-Control: public, max-age=300` |

The response lists **only** the combinations that qualify (AC-2/AC-3 thresholds live on the server, in one place). The frontend fetches it once per vehicle (and again when a different saved build is loaded) and matches the current paint/wheels locally. Other users' build IDs are never exposed — `firstOfKind` is only a boolean about the build the caller names.

```ts
export interface RareComboDto {
  paintId: string;
  wheelsId: string;
  percentage: number; // rounded UP to one decimal
}

export interface ComboRarityDto {
  sampleSize: number; // counted builds for this vehicle at the last run
  computedAt: string | null; // null = not computed yet
  rareCombos: RareComboDto[]; // empty below the minimum sample (AC-3)
  firstOfKind: boolean; // AC-5, for ?build=
}
```

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | reused — a malformed `?build=` |
| `404` | `VEHICLE_NOT_FOUND` | reused — unknown or deactivated vehicle |

### Breaking-change check

- [x] Additive only.

---

## 4. Data model changes

```prisma
// A derived cache, rewritten wholesale by each run — so the option ids and the first build's
// id are plain columns, not FKs (a stale id just stops matching until the next run).
model ComboRarityStat {
  id                   String   @id @default(cuid())
  vehicleId            String
  vehicle              Vehicle  @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  paintId              String
  wheelsId             String
  count                Int
  sampleSize           Int      // counted builds for this vehicle at computation time
  firstConfigurationId String   // the earliest build with this pair (AC-5)
  computedAt           DateTime @default(now())

  @@unique([vehicleId, paintId, wheelsId])
}
```

### Migration

- **Name:** `add_combo_rarity_stat`
- **Reversible:** yes.
- **Backfill required:** no — first aggregation run populates it.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **No badge** | AC-3 — the default, most common state |
| **Badge shown** | a small, tasteful inline element under the vehicle name in the build summary, not a modal/interruption; hovering shows the sample size ("Based on 240 saved builds") |
| **Loading / error** | no badge — a missing badge is the correct fallback, never an error message |

The badge is deliberately not an `aria-live` region: Spec 9 AC-7 keeps the summary's one live region for the total. It is read in document order with the rest of the summary.

**Route(s):** integrated into Spec 9's build summary.
**Directory:** `backend/src/jobs/computeComboRarity.ts`, `backend/src/services/comboRarity.ts`, `frontend/src/components/configurator/RarityBadge/`, `frontend/src/state/comboRarityStore.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | rounding up, the 5% threshold on the exact ratio, the minimum sample (AC-3), job scheduling / disabling / no overlapping runs | `backend/tests/comboRarity.test.ts` |
| **Component** | badge shows/hides from the lookup, follows paint/wheels changes, one decimal place, first-of-kind only for the unchanged saved build | `frontend/tests/configurator/RarityBadge.test.tsx` |
| **Integration** | aggregation against real data (expired builds excluded, reruns replace), endpoint accuracy, first-of-kind, 400/404 | `backend/tests/integration/comboRarity.int.test.ts` |
| **E2E** | seeded data → a rare saved build shows both badges, changing wheels removes them; a default build shows none | `frontend/e2e/rarity-badges.spec.ts` (seeds via `backend/tests/fixtures/seedRarityE2E.ts`, since the save rate limit rules out 50+ saves through the UI) |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Real-time (per-request) computation — always cached/periodic, to avoid an expensive aggregate query on every build-summary render.
- Badges for anything beyond paint+wheels combinations and the first-of-kind achievement for them — no package-based "first" badges, and no broader gamification system (points, levels, leaderboards).

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | With a small catalog (two vehicles) and a portfolio-scale user base, the minimum-sample-size gate (AC-3) may mean badges rarely or never show in practice. | Product owner | Resolved — accepted; correctness (never showing a misleading stat) takes priority over the feature always having something to display. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** after Spec 10 (needs `Configuration` data to aggregate over).
- **Rollback:** remove the badge component and aggregation job; build summary is unaffected otherwise.
- **Observability:** each run logs its duration and vehicle/combination/build counts (`[jobs] combo rarity computed`), and failures (`[jobs] combo rarity failed`).
