# CLAUDE.md — Virtual Car Configurator

Guidance for any Claude Code session working in this repository. Read this before writing code or a new spec.

## What this project is

A premium, cinematic 3D virtual car configurator and digital showroom — not a simple demo. Full requirements live in [`Virtual car configurator spec · MD`](../Virtual%20car%20configurator%20spec%20%C2%B7%20MD) (the SRS). That document is the source of truth for *what* to build; this file and `docs/specs/` govern *how*.

**Payments are test-mode only, permanently.** The reservation/deposit feature (`20-reservation-deposit.md`) uses Stripe strictly in test mode as a portfolio demonstration of a checkout flow — this is a non-negotiable, permanent project constraint, not a temporary development state. Never configure live Stripe keys in this project under any circumstance.

## Workflow: specs before code

This repo follows the spec-first workflow described in [`TEMPLATE - SPEC.md`](../TEMPLATE%20-%20SPEC.md):

1. Every feature gets its own spec file in `docs/specs/`, named `NN-<slug>.md` where `NN` is its two-digit build-order number matching `README.md`'s index (e.g. `01-project-foundation.md`, `18-car-comparison.md`), built from the template.
2. `docs/specs/README.md` is the index — it tracks phase, SRS section mapping, and status (Backlog → Draft → Approved → Implemented → Superseded) for every feature, including ones not spec'd yet.
3. **A spec is written and reviewed one file at a time.** Do not batch-generate multiple spec files before the previous one has been reviewed — the user explicitly wants each spec checked before the next is drafted, since later specs build on decisions made in earlier ones.
4. A coding agent implements a feature by reading its spec file plus every spec it depends on (each spec's header names its dependencies). If implementation reveals the spec was wrong or incomplete, update the spec in the same pull request — a spec that no longer matches the code is worse than no spec.
5. Delete the template's guidance blockquotes when filling in a real spec; keep every heading, writing "None" where a section genuinely doesn't apply.

## Foundational decisions already locked in

These were resolved with the user before Phase 1 specs were written (see `docs/specs/README.md` for the full rationale) and should not be re-litigated inside individual feature specs:

| Area | Decision |
|---|---|
| Database | PostgreSQL + Prisma |
| AI provider (Phase 2 CarAI) | Claude API |
| Frontend framework | Next.js (React), not the SRS's originally-listed Vite — needed for per-build dynamic Open Graph images (SRS §34.3) |
| Backend | Node.js + Express, kept as a separate app from the Next.js frontend |
| 3D | Three.js + React Three Fiber + Drei, GLB/GLTF assets |
| Phasing | Core-first: 3D showroom + customization + pricing + save/share (guest mode) ship before AI, auth, or business/trending extras |

## Spec file metadata

Every spec file's header uses:

```
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
```

Use these values for every spec, requirements document, or technical specification created in this repository, unless the user explicitly says otherwise for a specific document.

## Conventions established by Phase 1 specs

Later specs and implementations must follow these rather than inventing alternatives:

- **Money** is always an integer number of cents (`priceDeltaCents`, `basePriceCents`, `totalPriceCents`), never a float. Formatting for display happens at the UI layer only.
- **API error envelope**: `{ code: "SCREAMING_SNAKE_CASE", message: string, details?: Record<string, string[]> }`. New codes are listed in the owning spec's "Error codes" table before they're used, and are stable forever once shipped.
- **Customization categories** are a fixed enum: `PAINT | WHEELS | BRAKE_CALIPER | INTERIOR_MATERIAL | INTERIOR_LIGHTING | ACCESSORY | PACKAGE`. The first five are single-select and required; the last two are multi-select and optional.
- **Client-side configuration state** lives in one Zustand store (`frontend/src/state/configurationStore.ts`), canonically defined in `06-exterior-customization.md`. New customization specs extend this store; they do not create parallel state.
- **Pricing** has exactly one formula (base + sum of selected option deltas), defined once in `03-dynamic-pricing-engine.md`. It is implemented independently on frontend (instant local UI feedback) and backend (authoritative, used before every save) and kept in sync via a shared JSON fixture test, not shared code — see that spec's Risk #1 for why.
- **No fake interactions** (SRS §32): any spec that lets a user change a configuration option must make that change visible in the actual 3D scene (material swap, mesh swap, or real light/animation state change) wherever the required 3D asset capability exists — never a UI-only label change.
- **Accessibility baseline**: every interactive control is keyboard-reachable with a visible focus state, and every animated transition has a `prefers-reduced-motion` fallback that cuts to the end state instead of playing.

## Known open blocker across multiple specs

No production 3D asset exists yet. Multiple Phase 1 specs (`02-vehicle-catalog-data-model.md` Risk #1, and the landing page, showroom core, and exterior customization specs that depend on it) are blocked on choosing one free, portfolio-safe (CC0/permissive license) GLB car model with separately addressable wheel meshes, a body material slot, and door hinge/animation support. Resolve this before implementation begins on any of those specs, even though the specs themselves can be reviewed and approved without it.

## Repository layout

```
Virtual car configurator/
├── Virtual car configurator spec · MD   # SRS — product requirements, do not edit casually
├── TEMPLATE - SPEC.md                   # template for new feature specs
├── TEMPLATE - Incident.md
└── docs/
    ├── CLAUDE.md                        # this file
    ├── architecture.md                  # technical architecture, synthesized from docs/specs/
    ├── user-flow.md                     # end-to-end user journey, traced to the SRS and architecture.md
    └── specs/
        ├── README.md                    # spec index, phase plan, status tracking
        └── NN-<slug>.md                 # one file per feature, NN = build-order number
```

The actual application code (`frontend/`, `backend/`) does not exist yet — it is created by implementing `01-project-foundation.md`, the first spec in the index.
