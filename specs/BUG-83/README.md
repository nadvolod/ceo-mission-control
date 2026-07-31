# BUG-83: Mobile dashboard form focus zoom

**Issue:** [#83 — Screen is cut when entering information on mobile for the Daily Log](https://github.com/nadvolod/ceo-mission-control/issues/83)

**Status:** Implemented — CI verified; Vercel preview verification blocked by missing runtime configuration

**Target:** Current `/dashboard` experience

**Branch:** `codex/fix-83-mobile-dashboard-forms`

## Summary

On iPhone Safari, focusing a dashboard form control whose text is smaller than
16px causes the browser to zoom the page. The focused field remains visible,
but labels and neighboring fields can move outside the visual viewport. The
Morning Log screenshots in BUG-83 show this horizontal clipping.

The proposed fix establishes one mobile form contract for the current
dashboard: below the `md` breakpoint, every dashboard `input`, `select`, and
`textarea` has a computed font size of at least 16px. Desktop typography and
form behavior remain unchanged. Browser pinch zoom remains enabled.

## Documents

- [Requirements](requirements.md) — scope, user flows, requirements, and acceptance criteria.
- [Design](design.md) — evidence, root cause, chosen solution, risks, and rejected alternatives.
- [Test plan](test-plan.md) — red/green proof, browser coverage, visual evidence, and commands.
- [Tasks](tasks.md) — ordered implementation and delivery checklist.

## Decisions

| Decision | Outcome | Reason |
| --- | --- | --- |
| Scope | All form controls in the current `/dashboard` experience | Prevents the same Safari behavior in other dashboard editors without affecting unrelated pages. |
| Mobile boundary | Viewports below 768px | Matches the dashboard's existing Tailwind `md` layout boundary. |
| Minimum control text size | 16px | Avoids iPhone Safari's focus zoom while keeping browser zoom accessible. |
| Implementation | One scoped CSS media rule | Smaller and easier to audit than editing each control independently. |
| Portal handling | Mark the command palette root with `mc-root` | Radix portals render outside the dashboard DOM tree and otherwise miss the scoped rule. |
| Visual proof | Paired desktop and iPhone Playwright snapshots | Required by `AGENTS.md` and protects both responsive states. |

## Verification evidence

- Red-before CI: [run 30648412642](https://github.com/nadvolod/ceo-mission-control/actions/runs/30648412642/job/91215988443?pr=84) failed only the new regression, reporting `morning-log-note` at 13px while 89 browser tests passed.
- Ubuntu baseline generation: [run 30649146614](https://github.com/nadvolod/ceo-mission-control/actions/runs/30649146614) passed PW-1, PW-2, PW-3, and Monthly Review baseline generation.
- Green CI: [run 30649524496](https://github.com/nadvolod/ceo-mission-control/actions/runs/30649524496/job/91219540591?pr=84) passed 91 Playwright tests, including all three BUG-83 cases.
- Coverage remained at 50.09% statements/lines, 79.8% branches, and 67.51% functions; the production patch adds no executable JavaScript logic.
- The Vercel preview is built and `READY`, but its live `/dashboard` request currently fails before application rendering because the Vercel Preview environment has no `IRON_SESSION_PASSWORD`. Runtime log: `iron-session: Bad usage. Missing password.`

## Traceability

| Requirement | Verified proof |
| --- | --- |
| REQ-1, REQ-2 | PW-1 computed-style regression across dashboard form surfaces |
| REQ-3 | PW-2 focused Morning Log containment and typing flow |
| REQ-4 | PW-3 paired desktop/iPhone screenshots and existing desktop regression suite |
| REQ-5 | Code review confirming no viewport zoom restriction; PW-2 focused interaction |
| REQ-6 | Existing functional Playwright suite, unit/integration suite, and build |
| REQ-7 | Source-scope inspection plus unaffected page tests |

The specification was approved before the regression test and production
changes were committed. Final delivery remains gated on working Vercel Preview
runtime configuration and reviewer-bot completion.
