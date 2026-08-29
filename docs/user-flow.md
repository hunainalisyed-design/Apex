# APEX — End-to-End User Flow

**Sources:** [`Virtual car configurator spec · MD`](../Virtual%20car%20configurator%20spec%20%C2%B7%20MD) (the SRS, 36 sections, referenced below as `§N`) and [`architecture.md`](architecture.md) (11 sections, referenced below as `A§N`). Every step below traces to at least one section in one or both files; nothing here introduces a feature not already specified. Spec numbers (`Spec NN`) refer to `docs/specs/NN-<slug>.md`, cited as the connective tissue between the two source documents, not as a third source of new decisions.

---

## 1. Flow Overview

A visitor arrives at a cinematic landing page, explores the two-vehicle catalog, and enters a 3D showroom where they customize paint, wheels, interior, and accessories in real time while a live price updates alongside them. At any point they can ask CarAI, in text or voice, to recommend a configuration instead of clicking through it manually, and apply that recommendation with one action. Once satisfied, they review a consolidated build summary, save it (instantly, no account required), and share it as a link or a captured image. An account is never required for any of this — it only becomes relevant at a small number of specific, later moments: publishing a build to the public gallery, keeping builds permanently in a personal dashboard, or submitting a quote/reservation as a returning identity. Vehicle comparison and a handful of delight features (AR placement, dynamic environments, a driving mini-mode) exist as parallel side paths a user can dip into and back out of without disrupting the core loop.

High-level stages:

1. **Landing** — cinematic hero, first impression (`§3`)
2. **Explore Models** — browse the catalog (`§2`, `§6`)
3. **Enter 3D Showroom** — select a vehicle, land in its default configuration (`§4`, `§5`)
4. **Customize** — exterior, interior, accessories/packages, each with live 3D + price updates (`§7`–`§12`)
5. **AI Assist (optional)** — describe intent to CarAI, review and apply/reject a recommendation (`§13`–`§16`)
6. **Review Build** — consolidated summary and total price (`§17`)
7. **Capture / Save (optional but typical)** — screenshot, video, save for a shareable link (`§18`, `§19`)
8. **Auth Gate (contextual, not mandatory)** — only at specific account-requiring actions (`§36.5`)
9. **Post-save branches** — share/load by link, My Garage, publish to gallery, request quote, reserve with deposit
10. **Parallel side paths** — comparison, AR, dynamic environments, sound, drive-it mode, live collaboration — enterable from the showroom at any time, none blocking the core loop

---

## 2. Detailed Step-by-Step Flow

### Step 1 — Landing

- **Goal:** form a premium first impression; give the user two clear next actions.
- **Screen:** `/` (`§3`; Spec 04).
- **User actions:** wait for the reveal sequence, or immediately click **"Configure Your Car"** / **"Explore Models"** — the SRS explicitly requires the reveal never blocks these (`§3`; Spec 04, AC-2).
- **System response:** background fade-in → vehicle reveal → camera move-in → headline → CTAs → idle rotation (`§3`). Rendering handled by the 3D layer (`A§2.2`); headline/CTAs render immediately via SSR, not waiting on the 3D asset (`§26`; Spec 04, AC-4).
- **Decision points:** WebGL supported vs. not (falls back to `<Static3DFallback>`, `A§11`; Spec 12/04, AC-5) · `prefers-reduced-motion` (skips the staged reveal, `A§2.4`).
- **Exit conditions:** click "Explore Models" → Step 2; click "Configure Your Car" → Step 3 (default vehicle).

### Step 2 — Explore Models

- **Goal:** compare the catalog at a glance and pick a vehicle.
- **Screen:** `/models` (`§6`; Spec 05).
- **User actions:** browse vehicle cards (name, tagline, base price, thumbnail); click a card.
- **System response:** cards populated from the live catalog (`A§4.1`, `GET /api/vehicles`).
- **Decision points:** none — every listed vehicle is selectable.
- **Exit conditions:** click a card → Step 3, scoped to that vehicle's slug.

### Step 3 — Enter 3D Showroom

- **Goal:** land in an interactive, default-configured 3D view of the chosen vehicle.
- **Screen:** `/configure/{slug}` (`§4`, `§5`; Spec 05).
- **User actions:** orbit (drag), zoom (scroll/pinch), jump to a camera preset (Front/Rear/Left/Right/Side/Top/Interior/Cockpit), Reset, hover a hotspot for a labeled highlight, toggle headlights/brake-light demo.
- **System response:** GLB loads with a determinate "INITIALIZING SHOWROOM..." screen (`§26`; Spec 12); vehicle renders in its **default** configuration — every category pre-populated from its `isDefault` catalog row (`A§4.2`; Spec 02, AC-4) — idle rotation begins.
- **Decision points:** invalid slug → 404 with a link back to `/models` · GLB/WebGL failure → static fallback, vehicle name/specs still shown as text (`A§11`) · touch vs. pointer input (`§27`).
- **Exit conditions:** proceeds directly into Step 4 — there is no separate "confirm vehicle" step; the showroom *is* the customization surface.

### Step 4 — Customize (Exterior → Interior → Accessories/Packages)

- **Goal:** assemble a build across all customizable categories.
- **Screen:** same route, three panel tabs (`§7`–`§11`; Specs 06, 07, 08).
- **User actions:**
  - **Exterior tab:** select paint (including a live-drag custom color picker), wheels, brake calipers, window tint, spoiler, front/rear accessories, body package, carbon components (`§7`–`§9`; Spec 06).
  - **Interior tab:** select overall finish grade, then independently recolor seats/dashboard/steering wheel/door panels/floor, plus ambient lighting color — opening this tab auto-transitions the camera to the Interior preset (`§10`; Spec 07).
  - **Accessories tab:** toggle any combination of accessories and packages on/off (`§11`; Spec 08).
- **System response:** every selection updates the real 3D material/mesh/visibility immediately (`§32`'s "no fake interactions" rule, enforced architecturally via `applyMode`, `A§11`) and recalculates the total price client-side with no network round trip (`A§4.3`; Spec 03, AC-7).
- **Decision points:** single-select categories always replace the prior choice; multi-select (accessories/packages) accumulate independently, with no bundling logic between them (Spec 08, Risk #1).
- **Exit conditions:** the user can move to Step 5 (AI), Step 6 (review), or any capture/save/side-path action at any time — this step has no fixed exit; it's a persistent surface the user returns to throughout the session.

### Step 5 — AI Assist (optional)

- **Goal:** get a configuration recommendation from natural language instead of manual selection.
- **Screen:** floating chat button / nav "AI Assistant" entry, either opens the chat over the current showroom (`§15`; Spec 15).
- **User actions:** type or speak (`§35.3`; Spec 34) a request (e.g. "make it more aggressive," "give me a configuration under €100,000"); review the reply and, if given, a recommendation card with a before/after slider (`§35.4`; Spec 36); click **Apply Configuration** or ignore it.
- **System response:** request sent with the vehicle slug and current selections (`A§6.1`) to `POST /api/ai/configure`; Claude's tool-use call is enum-constrained to that vehicle's real catalog, so any recommendation returned is guaranteed applicable (Spec 14, AC-1–AC-3); applying it merges directly into the same store Step 4's manual clicks use — **no separate apply code path** (Spec 15, AC-7).
- **Decision points:** `recommendation: null` (message doesn't warrant a change) → reply only, no card · AI provider failure → inline error, manual configuration remains fully available (`§28`; Spec 14, AC-6) · user may also request a purely aspirational **AI Concept Render** (`§35.3`; Spec 35), which is unmistakably labeled non-buildable and has no Apply action at all — a structurally separate path from a real recommendation (`A§6.2`).
- **Exit conditions:** applied or dismissed, returns to Step 4/6 — this step is optional and repeatable at any point in the session, including before any manual selection has been made.

### Step 6 — Review Build Summary

- **Goal:** see one consolidated view of the build before deciding what to do with it.
- **Screen:** persistent Build Summary panel (`§17`; Spec 09).
- **User actions:** review vehicle name, exterior color (or custom hex), wheels, interior finish always shown; any other non-default category shown conditionally; active accessories/packages listed explicitly (including "None"); total price.
- **System response:** derived live from the same configuration store and pricing function as Steps 4–5 (`A§3.2`) — never a separately-fetched or separately-computed value.
- **Decision points:** none — purely a display step, though it may also surface a rarity badge if the paint+wheel combination is genuinely uncommon (`§35.2`; Spec 32).
- **Exit conditions:** proceeds to Step 7 (capture/save) or any side path.

### Step 7 — Capture and/or Save

- **Goal:** produce something shareable, and/or persist the build.
- **Screen:** same route; Save/Share panel and Capture Build action (`§18`, `§19`; Specs 10, 11).
- **User actions:** **Save** → get a `publicId` (e.g. `APEX-7F82-K91X`), copy the ID or a full share link · **Capture Build** → get a downloadable image (`§19`) or, optionally, a short vertical video clip (`§35.1`; Spec 30) · **Reset** → revert to defaults without affecting any already-saved build.
- **System response:** Save authoritatively recalculates price server-side before persisting (Spec 10, AC-1, AC-9); Capture Build **auto-saves first if the build is unsaved or changed** (Spec 11, AC-1) — so every captured image/video corresponds to a real, loadable link; the price is guaranteed truthful regardless of entry point (`A§4.3`).
- **Decision points:** guest (`userId: null`, expires in 90 days) vs. signed-in (`userId` set, never expires) — this is the **first point where sign-in state actually changes stored behavior**, though it's never required to reach this step (`§36.5`; Spec 17, AC-6). See §6 (Open Gaps) on exactly where the auth gate sits.
- **Exit conditions:** a `publicId` now exists; the user may leave, share the link, or continue configuring (which does **not** overwrite the saved snapshot — saving again creates a new one, Spec 17, AC-4).

### Step 8 — Share / Load by Link

- **Goal:** let anyone else see (and, if desired, continue) the exact same build.
- **Screen:** `/configure/{slug}?build={publicId}` (`§18`; Spec 10).
- **User actions:** open a shared link.
- **System response:** every selection hydrates from the saved snapshot, not defaults (Spec 10, AC-4); if the `publicId`'s actual vehicle differs from the URL's slug, the app redirects to the correct one (Spec 10, AC-5).
- **Decision points:** unknown/invalid `publicId` → "This build could not be found" (`§28`).
- **Exit conditions:** the recipient is now in Step 4/6 with the loaded build — the flow re-enters the core loop, it doesn't branch into something new.

---

## 3. Branch Flows

### 3a. Guest vs. Authenticated Path (`§36.5`; `A§8.2`)

```
Guest (default)                          Signed-in
────────────────                         ─────────
Configure, price, save, share  ──same──▶ Configure, price, save, share
   │                                          │
   ▼                                          ▼
Save → guest Configuration            Save → owned Configuration
(userId: null, expires 90d)           (userId: set, never expires)
   │                                          │
   ▼                                          ▼
Click "Publish to Gallery" /            Publish / My Garage /
"My Garage" / submit a Lead/            Reservation proceed directly
Reservation wanting persistent ID
   │
   ▼
Redirected to /login (return-to
set) ── sign up or log in ──▶ back to the same action, now as
                               a signed-in user
   │
   ▼
Optionally: "Save to My Garage" on
a guest build already created →
claims it (userId set, expiry
cleared) without losing the
original link (Spec 17, AC-7/AC-8)
```

Nothing in Steps 1–7 differs by auth state except what's persisted after Save (`§36.5`; Spec 10 vs. Spec 17).

### 3b. AI Assistant Path (`§13`–`§16`; `A§6`)

```
Chat opened (floating button or nav "AI Assistant")
   │
   ▼
User message (typed or voice, §35.3) ──▶ POST /api/ai/configure
   │                                          │
   │                                          ▼
   │                              Claude tool-use, enum-constrained
   │                              to the vehicle's real catalog
   │                                          │
   │                    ┌─────────────────────┼─────────────────────┐
   │                    ▼                     ▼                     ▼
   │            recommendation: null   valid recommendation   provider error
   │                    │                     │                     │
   │                    ▼                     ▼                     ▼
   │            reply only, no card   reply + card (+ price,   inline error,
   │                                   before/after slider)     manual config
   │                                          │                 unaffected
   │                                          ▼
   │                                  Apply Configuration
   │                                          │
   │                                          ▼
   │                          merges into the SAME store Step 4 uses —
   │                          no separate apply pipeline (Spec 15, AC-7)
   ▼
[separately] "Imagine the Ultimate Version" → AI Concept Render
             (image only, unmistakably labeled, no Apply action —
             never confusable with a real recommendation, §35.3)
```

### 3c. Save → Share → Load-by-Link Path (`§18`; `A§4.3`)

```
Configure (Step 4) ──▶ Save ──▶ publicId issued ──▶ Copy ID / Copy Share Link
                                       │
                                       ▼
                          Recipient opens /configure/{slug}?build={publicId}
                                       │
                                       ▼
                        Hydrates exact saved selections (not defaults)
                                       │
                          ┌────────────┴────────────┐
                          ▼                          ▼
                 slug matches publicId's      slug mismatched →
                 vehicle → renders directly    redirected to correct slug
```

### 3d. Error Paths (`§28`; `A§11`)

| Failure | Where it can occur | Behavior |
|---|---|---|
| 3D model load failure / no WebGL | Landing hero, Showroom, Comparison 3D view | Static image + text fallback; rest of the page (headline, CTAs, spec table) stays usable |
| AI provider failure | CarAI chat | "CarAI is temporarily unavailable. You can continue configuring manually." — manual customization is never blocked |
| Backend save failure | Save/Share, Lead, Reservation | "Something went wrong while saving your configuration." — in-progress selections are never lost, Save can be retried |
| Invalid/expired shared link or reset token | Load-by-link, Password reset | Clear, specific message with a path forward (start new build / request a new reset link) — never a generic crash |

Every one of these is a **dead end recovered from in place**, not a redirect away from where the user was.

### 3e. Vehicle Comparison — Parallel Side Path (`§20`; `A§2.2`, Spec 18)

```
From nav "Compare" (any page) ──▶ /compare (defaults to first two vehicles)
        │
        ▼
Spec table (Power / 0–100 / Top Speed / Starting Price) ── toggle ──▶ 3D side-by-side view
        │                                                                  │
        ▼                                                                  ▼
"Configure This Vehicle" on either side ──────────────────────▶ Step 3 (Showroom) for that vehicle
```

Comparison intentionally compares **base vehicles**, not customized builds (Spec 18, Risk #1) — it's a decision-support side path reachable from anywhere via the nav, not a stage inside the configure-and-save funnel.

### 3f. Live Collaborative Build — Upgrade of Step 3/4 (`§35.2`; `A§7`, Spec 33)

```
Solo showroom session (Step 3/4) ──▶ "Start Live Session" ──▶ shareable live link
                                                                     │
                                                                     ▼
                                          Second participant opens the link
                                                                     │
                                                                     ▼
                        Both see presence cursors; either's selection change
                        broadcasts to both within ~1s (last-write-wins/category)
                                                                     │
                                                                     ▼
                                  Either clicks "Save" → normal Step 7 (Save),
                                  ending the live-collaborative aspect
```

This is not a separate entry point at Landing — it only exists as an upgrade from an already-open solo session (Spec 33, AC-1).

### 3g. Admin / Internal Path (not part of the customer journey — `§34.1`; `A§8.3`, Specs 19–21)

A distinct actor, not a branch of the customer flow above: an `ADMIN`-role user visits `/admin` to manage the catalog (create/edit vehicles and options), and to work incoming Leads (Step 7-adjacent, from `POST /api/leads`) and view Reservations (from Step 7-adjacent Stripe checkouts). Non-admins get a generic 404 on `/admin`, not a "forbidden" page (Spec 21, AC-1).

---

## 4. Sequence Diagram (Primary Happy Path)

```
Landing Page
   │
   ▼
Explore Models
   │
   ▼
Select Vehicle → 3D Showroom (default configuration)
   │
   ▼
Customize Exterior (Paint / Wheels / Brakes / Tint / Spoiler / Accessories / Body Package / Carbon)
   │
   ▼
Customize Interior (Finish Grade → Seats / Dashboard / Steering Wheel / Door Panels / Floor / Lighting)
   │
   ▼
Add Accessories & Packages
   │
   ▼
[optional] Ask CarAI → Review Recommendation → Apply Configuration
   │
   ▼
Review Build Summary (vehicle, options, total price)
   │
   ▼
[optional] Capture Build (image / video)
   │
   ▼
Save Configuration ──▶ publicId issued
   │
   ▼
[Auth Gate — only if the NEXT action requires it: Publish to Gallery / My Garage / persistent Lead or Reservation]
   │                                                              │
   ▼ (guest, most common)                                        ▼ (sign up / log in)
Share Link / Copy Configuration ID                     My Garage / Publish to Gallery / Quote / Reservation
   │                                                              │
   ▼                                                              ▼
Recipient loads link → re-enters flow at "3D Showroom"    Confirmation (email + in-app)
with saved selections
```

---

## 5. Traceability Table

| Flow Step | SRS Section(s) | Architecture Section(s) | Notes / Assumptions |
|---|---|---|---|
| Landing | §3, §26, §29 | A§2.2, A§2.4, A§11 | Reveal sequence never blocks CTAs; reduced-motion cross-faces directly to end state. |
| Explore Models | §2, §6, §22 | A§4.1, A§5.2 | Nav "Models" link and landing "Explore Models" CTA both resolve here. |
| Enter 3D Showroom | §4, §5, §6, §27 | A§2.2, A§4.2, A§5.2 | Default configuration comes from catalog `isDefault` flags, not hardcoded. |
| Customize Exterior | §7, §7.1, §8, §9, §32 | A§2.3, A§4.2, A§11 | 9 categories, not the SRS's originally-implied 3; see Open Gap 1. |
| Customize Interior | §10, §32 | A§2.3, A§4.2 | Finish grade and per-surface color are independent inputs combined per surface. |
| Accessories / Packages | §11, §32 | A§2.3, A§4.2 | Multi-select, independent — no bundling with packages. |
| AI Assist (text) | §13, §14, §16, §32 | A§6.1 | Enum-constrained tool-use is the structural safety mechanism, not post-hoc filtering alone. |
| AI Assist (voice) | §35.3 | A§6.1 | Transcribes to the same text pipeline; no separate backend path. |
| AI Concept Render | §35.3 | A§6.2 | Structurally separate from real recommendations; never applicable. |
| Before/After Slider | §35.4 | A§2.2, A§6.1 | Visualization only; does not alter the Apply mechanism. |
| Review Build Summary | §12, §17, §35.2 (badges) | A§3.2, A§4.3 | Always-shown anchors + conditional lines; rarity badge is a bonus, not guaranteed to appear. |
| Capture Build (image) | §19 | A§2.2 | Auto-saves first if the build is dirty/unsaved. |
| Capture Build (video) | §35.1 | A§2.2 | Falls back to image capture on unsupported browsers. |
| Save Configuration | §18, §36.5 | A§4.1, A§4.3 | Guest by default; ownership/expiry differ by auth state only, per §36.5. |
| Share / Load by Link | §18 | A§5.2 | `publicId` is the source of truth for vehicle identity, not the URL's slug alone. |
| Auth Gate | §36.1–§36.3, §36.5, §36.6 | A§8.1, A§8.2 | Contextual, not a fixed step — see Open Gap 1. |
| My Garage | §36.4 | A§4.1, A§8.2 | "Edit" = load-then-save-as-new, never in-place mutation of a shared link. |
| Publish to Gallery | §35.2 | A§4.1, A§8.2 | Requires sign-in; no free-text fields, minimizing moderation surface. |
| Request Quote | §34.1 | A§5.2 | Works for guests; `userId` attached only if signed in. |
| Reserve with Deposit | §34.1 | A§5.2, A§9 | Stripe test mode, permanently — see `docs/CLAUDE.md`. |
| Vehicle Comparison | §20 | A§2.2 | Base vehicles only, not customized builds; reachable from any page via nav. |
| AR View in Driveway | §35.1 | A§2.2 | Progressive enhancement — button absent on unsupported devices. |
| Dynamic Environments | §35.1 | A§2.2 | Skybox + lighting change together; purely cosmetic, no pricing impact. |
| Sound Design | §35.1 | A§2.4 | Off by default; independent of reduced-motion. |
| Live Collaborative Build | §35.2 | A§7 | Upgrade of an existing solo session, not a separate entry point. |
| Drive It Mini-Mode | §35.4 | A§2.4 | Not offered under reduced-motion — no static fallback exists for it. |
| Admin / Internal | §34.1 | A§8.3 | Separate actor/persona, not part of the customer journey. |
| Error handling (all steps) | §28 | A§11 | One shared `getErrorMessage(code)` mapping; never raw codes/stacks shown. |

---

## 6. Open Gaps

The SRS presents its user journey (§2) and later feature sections (§3–§37 material) largely in narrative/document order, which is not the same as a strict execution order. The two source files are silent or ambiguous on several transitions; each is resolved below rather than left open, consistent with how the individual specs already made and documented similar calls.

1. **Exactly when does the auth gate interrupt the flow?**
   Neither source file states this explicitly. **Resolution:** the auth gate is **contextual, not positional** — it never sits as a fixed step in the middle of the funnel. A user can complete the entire core loop (Landing → Configure → AI → Review → Save → Share) as a guest, start to finish, with no interruption. Sign-in is only prompted at the exact moment a specific action requires an identity: clicking "Publish to Gallery," navigating to "My Garage," or (optionally, for a persistent record) submitting a Lead/Reservation. This matches §36.5's own framing ("An account is only required at the point of...") and every relevant spec's (10, 17, 19, 20, 31) design.

2. **Does Capture Build happen before or after Save?**
   §18 (Save) and §19 (Capture) are presented as separate, sequential sections with no stated dependency. **Resolution:** Capture implicitly triggers Save first if the current build is unsaved or has changed (Spec 11, AC-1) — a captured image/video must always correspond to a real, loadable link, so "capture" is really "save-if-needed, then capture," not an independent parallel action.

3. **Can CarAI be used before any manual customization?**
   §13–§16 are documented after §7–§11's manual customization sections, which could imply a required order. **Resolution:** no such requirement exists functionally — CarAI reads whatever the current selections are (defaults, if untouched) and can be invoked the instant the showroom loads. The SRS's section order reflects document organization, not a gate.

4. **Is Vehicle Comparison a step inside the funnel or a side path?**
   §20 sits after the customization/pricing sections in the document, which could be read as "compare after you've built something." **Resolution:** Comparison operates on **base vehicles**, not the user's in-progress customized build (matching §20's own worked example, which shows no customization), and is reachable from the nav bar at any time — before, during, or after configuring. It's a decision-support side path, not a funnel stage.

5. **Does a saved build's link ever change after the vehicle's assets are updated later (e.g. via the Admin panel)?**
   Neither source file addresses this. **Resolution:** a loaded configuration always renders using whichever asset URLs are *currently* set on the vehicle/options, not a historical snapshot — meaning a very old shared link could theoretically look slightly different if assets are updated much later. This is a known, accepted limitation (documented in Spec 25), not a bug; true pixel-perfect historical pinning was judged not worth the added complexity for this project's scale.

6. **Where does a live collaborative session fit relative to solo configuring?**
   §35.2 describes the feature but not its entry point. **Resolution:** it is only reachable as an explicit upgrade from an already-open solo showroom session (Spec 33) — there is no "start collaborating" option from the Landing page or `/models` directly.
