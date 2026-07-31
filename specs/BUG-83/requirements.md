# Requirements

## Problem statement

The current dashboard renders multiple form controls at 12–14px. On iPhone
Safari, focusing controls below 16px triggers automatic page zoom. In the
Morning Log's fixed-width drawer, that zoom moves left-side labels and adjacent
fields outside the visible viewport, making the form difficult to read and use.

The application calls this surface **Morning Log**; BUG-83 calls it **Daily
Log**. They refer to the same dashboard feature.

## Scope

### In scope

- The current `/dashboard` page at viewport widths below 768px.
- Form controls rendered inside the mobile dashboard layout.
- Dashboard overlays rendered through portals:
  - Morning Log
  - Reflection
  - Command palette
- Inline amount and hours editors.
- Monthly Review fields.
- Desktop regression protection for the same dashboard.

### Out of scope

- `/dashboard/legacy`.
- Landing, login, waitlist, and other non-dashboard forms.
- Redesigning rows, drawers, cards, or navigation.
- Changing validation rules, persistence, APIs, database schemas, or form copy.
- Disabling user scaling or pinch zoom.
- Adding provider, package, or runtime dependencies.

## User flows

### Happy path

1. A user opens `/dashboard` on an iPhone-sized viewport.
2. The user opens any dashboard editor or drawer.
3. The user focuses and types into a control.
4. The browser keeps the dashboard at its normal scale.
5. Labels, fields, and actions stay within the horizontal viewport.
6. The user completes the existing save or submit flow successfully.

### Validation failure

1. The user enters a value rejected by an existing validation rule, such as a
   zero dosage for a taken supplement.
2. Existing validation feedback and disabled actions remain unchanged.
3. The focused control and feedback remain readable without horizontal
   clipping.

### Network or server failure

1. A save request fails, times out, or returns an error.
2. Existing failure messaging and retry behavior remain unchanged.
3. The error and editable controls remain reachable through normal vertical
   scrolling and are not horizontally clipped.

### Empty and loading states

1. A drawer or editor opens before its data has loaded, or has no saved data.
2. Existing loading and empty-state behavior remains unchanged.
3. Any available controls still satisfy the mobile font-size contract.

## Functional requirements

### REQ-1: Mobile minimum font size

At viewport widths below 768px, every `input`, `select`, and `textarea` in the
current dashboard experience **must** have a computed font size of at least
16px.

### REQ-2: Dashboard surface coverage

REQ-1 **must** apply to the dashboard layout and to form-bearing overlays or
editors, including Morning Log, Reflection, command palette, inline amount and
hours editors, and Monthly Review.

### REQ-3: Focus containment

After a user focuses and types into a dashboard control on an iPhone-sized
viewport, the document and active surface **must not** develop horizontal
overflow, and visible labels or controls **must not** extend outside the
viewport because of application layout.

### REQ-4: Desktop compatibility

At viewport widths of 768px and above, existing component-defined form font
sizes and desktop layout **must** remain unchanged.

### REQ-5: Accessible browser zoom

The fix **must not** set `maximum-scale`, `minimum-scale`, `user-scalable=no`,
or an equivalent restriction. Users must retain browser pinch zoom.

### REQ-6: Behavioral compatibility

Existing form values, validation, keyboard handling, submission, persistence,
loading states, empty states, and failure messages **must** behave as before.

### REQ-7: Page isolation

The new mobile form rule **must not** affect `/dashboard/legacy`, landing,
login, waitlist, or other non-dashboard forms.

## Acceptance criteria

- AC-1: A Playwright regression fails on the pre-fix code because covered
  mobile dashboard controls compute below 16px.
- AC-2: The same regression passes after the scoped style change for every
  covered dashboard surface.
- AC-3: A focused and populated Morning Log at 390×844 has no horizontal
  document or drawer overflow.
- AC-4: Committed `toHaveScreenshot` baselines cover the focused Morning Log at
  1440×900 and 390×844.
- AC-5: The existing Monthly Review iPhone baseline is intentionally updated;
  its desktop baseline remains visually unchanged.
- AC-6: Lint, type checking, unit tests, real-database integration tests,
  coverage, production build, and the full localhost Playwright suite pass.
- AC-7: The Vercel preview passes the targeted mobile regression flow.
