# Tasks

Tasks are ordered. Do not begin a phase until its gate is satisfied.

## Phase 1: Specification

- [x] Create `codex/fix-83-mobile-dashboard-forms` from `origin/main`.
- [x] Create the five-file `specs/BUG-83/` package.
- [x] Record scoped requirements, minimal design, test plan, risks, and delivery gates.
- [x] Validate and commit the draft specification separately from tests and production code.
- [ ] Review the specification package with the user.
- [ ] Mark the specification approved in `README.md`.
- [ ] Commit the specification approval status before starting implementation.

**Gate:** Production code and regression tests must not change until the user
approves the specification package.

## Phase 2: Red-before regression

- [ ] Add `tests/e2e/mobile-form-zoom-visual.spec.ts`.
- [ ] Add PW-1 computed-font checks for each approved dashboard form surface.
- [ ] Add PW-2 focused Morning Log containment assertions.
- [ ] Run the targeted non-visual regression against the pre-fix code.
- [ ] Capture CLI output proving failure specifically because a covered control computes below 16px.

**Gate:** The test must reproduce BUG-83 for the expected reason, not because of
authentication, environment, server, or unrelated failures.

## Phase 3: Minimal fix

- [ ] Add the scoped mobile 16px form rule to `src/app/globals.css`.
- [ ] Add `mc-root` to command palette `Dialog.Content`.
- [ ] Confirm no viewport zoom restrictions or unrelated component changes were introduced.
- [ ] Re-run PW-1 and PW-2 and capture green output.

## Phase 4: Visual evidence

- [ ] Add desktop and iPhone `toHaveScreenshot` assertions for focused Morning Log.
- [ ] Push the branch so the Ubuntu baseline workflow can run.
- [ ] Generate and download the new Morning Log PNG baselines from `ubuntu-latest`.
- [ ] Regenerate the Monthly Review iPhone baseline.
- [ ] Confirm the Monthly Review desktop baseline has no intentional change.
- [ ] Commit all required PNG baselines.

## Phase 5: Full verification

- [ ] Run lint.
- [ ] Run TypeScript checking.
- [ ] Run unit tests.
- [ ] Run real-database integration tests.
- [ ] Measure coverage and confirm it is maintained.
- [ ] Run the production build.
- [ ] Run the complete Playwright suite against localhost.
- [ ] Review the diff for architecture, accessibility, logging, monitoring, and edge-case weaknesses.

## Phase 6: PR and deployment

- [ ] Open a PR with `Fixes #83` and the exact checked `AGENTS.md` checklist.
- [ ] Include behavior-first changes, happy/failure flows, screenshots, commands, results, coverage, and architectural review.
- [ ] Confirm all required environment-variable checks pass.
- [ ] Confirm CI is green.
- [ ] Confirm the Vercel preview builds and passes the targeted mobile regression.
- [ ] Review CodeRabbit and Copilot feedback and implement valuable changes.
- [ ] Re-run affected tests after review changes.
- [ ] Resolve all actionable bot threads and confirm every required check is green.
- [ ] Mark this package `Implemented` and `Verified` in `README.md`.

**Handoff gate:** Notify the user that the fix is ready to merge only after CI,
Vercel, reviewer bots, evidence, and the PR checklist are complete.
