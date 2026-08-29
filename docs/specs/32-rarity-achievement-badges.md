# Spec: Rarity / Achievement Badges

**File:** `docs/specs/32-rarity-achievement-badges.md`
**Status:** Draft
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
| AC-1 | **Given** a periodic aggregation job (not computed per-request) **When** it runs **Then** it computes, per vehicle, the frequency of each `(PAINT, WHEELS)` combination across all saved `Configuration` rows, and caches the result |
| AC-2 | **Given** cached frequency data **When** a build summary (Spec 9) renders **Then** if the current build's `(PAINT, WHEELS)` combination falls under a defined rarity threshold (e.g. under 5% of saved builds for that vehicle) **and** the sample size is large enough to be meaningful (e.g. at least 50 saved builds for that vehicle) **then** a badge appears: "Only {X}% of builds choose this combination" |
| AC-3 | **Given** the sample size is too small to be statistically meaningful **When** the build summary renders **Then** no badge is shown at all, rather than showing a misleadingly precise percentage from a handful of data points |
| AC-4 | **Given** the frequency data **When** computed **Then** the percentage shown is always genuinely accurate as of the last aggregation run — never a placeholder, fabricated, or rounded-to-sound-more-impressive number |
| AC-5 | **Given** an achievement-style badge (e.g. "First to configure the Full Carbon Package") **When** a genuinely first-of-its-kind combination is detected at aggregation time **Then** it may additionally be flagged — but only for combinations verifiably unique at computation time, following the same accuracy requirement as AC-4 |

---

## 3. API contract

No new user-facing endpoints. The aggregation is a scheduled backend job; its output is read by Spec 9's build summary via a small internal lookup, e.g. `GET /api/vehicles/:slug/combo-rarity?paint=X&wheels=Y` returning `{ percentage: number, sampleSize: number } | null`.

### Breaking-change check

- [x] Additive only.

---

## 4. Data model changes

```prisma
model ComboRarityStat {
  id          String   @id @default(cuid())
  vehicleId   String
  vehicle     Vehicle  @relation(fields: [vehicleId], references: [id])
  paintId     String
  wheelsId    String
  count       Int
  sampleSize  Int      // total configurations for this vehicle at computation time
  computedAt  DateTime @default(now())

  @@unique([vehicleId, paintId, wheelsId])
}
```

### Migration

- **Name:** `AddComboRarityStat`
- **Reversible:** yes.
- **Backfill required:** no — first aggregation run populates it.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **No badge** | AC-3 — the default, most common state |
| **Badge shown** | a small, tasteful inline element on the build summary, not a modal/interruption |

**Route(s):** integrated into Spec 9's build summary.
**Directory:** `backend/src/jobs/computeComboRarity.ts`, `frontend/src/components/configurator/RarityBadge/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | aggregation correctness, minimum-sample-size gating (AC-3), threshold logic | `backend/tests/jobs/comboRarity.test.ts` |
| **Component** | badge shows/hides correctly based on lookup response | `frontend/tests/configurator/RarityBadge.test.tsx` |
| **Integration** | lookup endpoint returns accurate cached data | `backend/tests/integration/comboRarity.int.test.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Real-time (per-request) computation — always cached/periodic, to avoid an expensive aggregate query on every build-summary render.
- Badges for anything beyond paint+wheels combinations and simple first-of-kind achievements — no broader gamification system (points, levels, leaderboards).

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
- **Observability:** log aggregation job run time/row counts.
