# Spec: AR "View in Your Driveway"

**File:** `docs/specs/27-ar-view-in-driveway.md`
**Status:** Draft
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.1 (AR); depends on `05-3d-showroom-core.md`, `06-exterior-customization.md`, `07-interior-customization.md`, `08-accessories-packages.md`

---

## 1. Problem statement

**Today:** A user can only see their build inside the browser's 3D scene. SRS §35.1 calls AR "the single biggest 'wow' feature in premium automotive configurators" — placing the actual configured car, life-size, in the user's real environment via their phone camera.

**Who is affected:** Mobile users on AR-capable devices (a meaningful but not universal subset — see Risk #1).

**Why it matters now:** It's the highest-impact item in the §35.1 group, but also the most technically demanding in this backlog after live collaboration (Spec 33) — worth spec'ing early in the trending group so its asset-pipeline implications are known before the others.

**Success looks like:** A user on a supported device taps "View in Your Driveway," points their phone at the floor, and sees their exact configured vehicle — the paint, wheels, and accessories they chose — standing there at real-world scale.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a device/browser combination that supports AR Quick Look (iOS Safari) or Scene Viewer (Android Chrome, via WebXR or `<model-viewer>`'s `ar` attribute) **When** the showroom loads **Then** an "View in Your Driveway" button is visible; **given** an unsupported device **when** the showroom loads **then** the button is not shown at all — progressive enhancement, no broken/dead button |
| AC-2 | **Given** the button is tapped **When** the AR asset is prepared **Then** it reflects the user's *exact current configuration* (paint, wheels, calipers, accessories — everything customizable via Specs 6–8), exported live from the Three.js scene via `GLTFExporter`, not a generic default model |
| AC-3 | **Given** the exported model **When** the platform is iOS **Then** a USDZ version is used for Quick Look (iOS does not support glTF/GLB directly); **given** Android **when** used **then** the GLB itself is used directly via Scene Viewer |
| AC-4 | **Given** the AR session **When** active **Then** the vehicle appears at real-world scale (using the vehicle's real dimensions, not an arbitrary default) and can be repositioned by the user per the platform's native AR UI (this spec doesn't build custom AR placement UI — it hands off to the OS-native viewer) |
| AC-5 | **Given** live export + USDZ conversion takes longer than an instant tap **When** the user taps the button **Then** a loading state shows until the AR viewer launches, with a clear error state if export or conversion fails |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/ar/export` | none | `200` (binary GLB or USDZ) | takes the current selections, server-side renders/converts (see Risk #2) |

### Request DTO

```ts
export interface ArExportRequest {
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
  platform: "ios" | "android";
}
```

### Breaking-change check

- [x] First version of this contract.

---

## 4. Data model changes

None — this spec composes existing catalog/selection data (Specs 2, 6–8) into an exported file; it persists nothing.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Unsupported device** | button absent entirely (AC-1) |
| **Loading** | "Preparing AR..." while export/conversion runs |
| **Error** | "AR preview unavailable right now" per Spec 12's pattern, configurator remains fully usable |
| **Success** | native AR viewer launches (iOS Quick Look / Android Scene Viewer) |

**Route(s):** button integrated into `/configure/[slug]`.
**Directory:** `frontend/src/components/ar/`, `backend/src/services/ar/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | GLB export includes all currently-selected materials/meshes | `frontend/tests/ar/export.test.ts` |
| **Integration** | USDZ conversion service produces a valid file from a known GLB input | `backend/tests/integration/ar.int.test.ts` |
| **E2E** | device-capability detection correctly shows/hides the button across mocked user agents | `frontend/e2e/ar-button-visibility.spec.ts` |

**Coverage:** ≥80% on new code (excluding the USDZ conversion binary itself, which is exercised via integration tests against known fixtures, not unit-tested internally).

---

## 7. Out of scope

- Any custom in-app AR placement UI — this spec hands off to the OS's native AR viewer entirely.
- Desktop AR (not a meaningful use case for "view in your driveway").

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | AR device/browser support is genuinely fragmented (iOS Safari and Android Chrome only, no desktop, older devices excluded) — SRS itself frames this as the biggest "wow" feature, but it will be invisible to a meaningful share of visitors. | Product owner | Resolved — accepted; AC-1's progressive-enhancement approach means it's a bonus for supported devices, never a broken experience for others. |
| 2 | Browser-side USDZ export isn't standard — this spec requires a server-side conversion step (e.g. Apple's USD tooling, or a third-party conversion service), which is real infrastructure this spec introduces just for one feature. | Implementer | Open — the single biggest implementation risk in this spec; recommend prototyping the GLB→USDZ conversion path early, independent of the rest of this spec's UI work, before committing to the full flow. |
| 3 | Live-exporting the current Three.js scene's *exact* materials (including a live-dragged Custom Color, Spec 6 AC-3) via `GLTFExporter` needs verification that all material types used in the showroom serialize correctly. | Implementer | Open — a technical spike, not a product decision. |

---

## 9. Rollout

- **Feature flag:** `AR_ENABLED` — easy to disable if the USDZ conversion service (Risk #2) proves unreliable in production.
- **Migration order:** N/A.
- **Rollback:** remove the button and export endpoint; no other spec depends on this one.
- **Observability:** log export/conversion success and failure rates per platform.
