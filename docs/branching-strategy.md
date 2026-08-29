# Branching Strategy

This project uses **GitHub Flow**: `main` is always deployable, and all work happens on short-lived branches merged back via pull request.

## Branches

- **`main`** — always in a working, deployable state. No direct commits; all changes land via pull request.
- **Working branches** — created off `main`, deleted after merge. Named `<type>/<short-description>`:

| Type | Used for | Example |
|---|---|---|
| `spec/` | Writing or revising a spec in `docs/specs/` | `spec/18-car-comparison` |
| `feature/` | Implementing a feature from an approved spec | `feature/06-exterior-customization` |
| `fix/` | Bug fixes | `fix/pricing-rounding-error` |
| `chore/` | Tooling, config, dependency, or non-product changes | `chore/eslint-setup` |
| `docs/` | Documentation-only changes outside `docs/specs/` | `docs/update-architecture` |

Match feature/spec branch suffixes to the spec's `NN-slug` naming from `docs/specs/README.md` where applicable, so a branch name maps directly to its spec file.

## Workflow

1. Branch off the latest `main`: `git checkout -b feature/xyz main`.
2. Commit in small, logical steps with clear messages.
3. Push the branch and open a pull request into `main` as soon as there's reviewable content — don't wait until the branch is "done" to open it (draft PRs are fine).
4. Keep the branch current with `main` (prefer `git rebase main` over merge commits for working branches, to keep history linear).
5. PR must be reviewed and pass CI (once CI exists — see `docs/specs/22-cicd-monitoring-logging.md`) before merge.
6. Merge via **squash merge** — one clean commit per feature lands on `main`, full history stays on the PR.
7. Delete the branch after merge.

## Branch protection (configure on GitHub — not enforceable from git alone)

Enable on `main` under Settings → Branches → Branch protection rules:

- Require a pull request before merging (no direct pushes, including for admins).
- Require status checks to pass before merging, once CI is in place.
- Require branches to be up to date before merging.
- Require linear history (blocks merge commits, keeps squash-only).

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) style where practical: `type(scope): summary`, e.g. `feat(pricing): add cents-based rounding`, `docs(specs): approve 03-dynamic-pricing-engine`, `fix(3d): correct wheel mesh swap on material change`.
