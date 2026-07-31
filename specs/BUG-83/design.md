# Design

## Evidence and root cause

BUG-83 includes iPhone Safari screenshots where focusing Morning Log number
fields zooms toward the active control. The right-side field remains visible
while left-side row labels are cut off.

Repository inspection shows dashboard controls with inline `fontSize` values
between 12px and 14px, including:

- Morning Log number, text, date, edit, and note fields.
- Reflection textareas.
- Command palette search.
- Amount and hours editors.
- Monthly Review fields.

iPhone Safari automatically zooms focused form controls whose rendered text is
smaller than 16px. The fixed-width Morning Log drawer makes the zoom especially
visible, but the cause is shared by the other dashboard forms.

## Chosen solution

Add one rule after the existing Mission Control form rules in
`src/app/globals.css`:

```css
@media (max-width: 767px) {
  .mc-root input,
  .mc-root select,
  .mc-root textarea {
    font-size: 16px !important;
  }
}
```

The 767px upper bound matches the layout's `md` breakpoint: mobile below 768px
and desktop from 768px upward.

`!important` is intentional and narrowly scoped. Many controls use React inline
styles, which otherwise outrank a stylesheet rule. Removing or refactoring all
inline sizes would create a much larger and riskier change.

## Portal coverage

Radix Dialog portals render under `document.body`, outside the dashboard layout
that normally carries `mc-root`.

- Morning Log already puts `mc-root` on `Dialog.Content`.
- Reflection already puts `mc-root` on `Dialog.Content`.
- Command palette does not; add `mc-root` to its `Dialog.Content` class list.

No additional form-bearing dashboard portals were found.

## Data and interface impact

- Public APIs: none.
- Component props: none.
- Database/schema: none.
- Stored data: none.
- Dependencies: none.
- Runtime or Next.js configuration: none.
- Version bump: none; this is a patch-level bug fix covered by repository merge
  automation.

## Accessibility

The solution prevents Safari's automatic focus zoom by making the control text
legible at the browser's normal scale. It does not disable user-controlled page
zoom. Focus order, labels, keyboard types, and control semantics remain intact.

## Monitoring and logging

No new runtime logging is warranted for a CSS-only rendering contract. Logging
field focus or typed values would add noise and could expose sensitive user
content. Regression monitoring is provided by deterministic computed-style
checks, paired visual baselines, the full Playwright suite, and Vercel preview
verification. Existing save failure logging and visible error states remain
unchanged.

## Risks and mitigations

| Risk | Priority | Mitigation |
| --- | --- | --- |
| Compact mobile editors wrap after their text grows to 16px | High | Exercise amount/hours editors, assert containment, and review iPhone snapshots. |
| A portal misses the `.mc-root` selector | High | Inventory form-bearing portals and add `mc-root` to command palette content. |
| `!important` overrides an intentional smaller mobile control | Medium | Restrict it to form elements, `.mc-root`, and widths below 768px. |
| Monthly Review visual baseline changes unexpectedly | Medium | Regenerate the iPhone baseline intentionally and prove the desktop baseline is unchanged. |
| Chromium does not reproduce iOS's native zoom animation | Medium | Test the causal contract directly: computed font size must be at least 16px. |

## Rejected alternatives

### Disable browser zoom in viewport metadata

Rejected because it harms accessibility, changes the whole application, and
violates REQ-5.

### Change only Morning Log fields

Rejected because the same sub-16px controls exist across current dashboard
surfaces and the approved scope is all current dashboard forms.

### Edit every inline style

Rejected because it spreads a browser-compatibility invariant across many
components, increases regression risk, and makes future enforcement harder.

### Detect Safari in JavaScript

Rejected because the issue has a standards-compatible CSS solution and does
not require user-agent detection or client-side effects.
