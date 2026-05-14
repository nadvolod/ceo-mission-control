# Quarantined: dashboard.spec.ts.todo

The 45 tests in `dashboard.spec.ts.todo` were written before owner_id scoping
and assume the dashboard is reading the admin's production data. After PR 2:

- All Playwright tests run as the `test@ceo-mc.local` test user against localhost.
- `global-setup.ts` wipes the test user's rows before every run.
- Most of the old tests assert on values that no longer exist for the test user
  (scorecard date, specific financial metrics, weekly tracker entries with real
  data, etc.).

They will be re-enabled in PR 4, when the curation UI ships and we can either
seed the test user with a deterministic fixture or remove the data-dependent
assertions in favor of pure render checks.

To re-enable for ad-hoc local testing:
```
mv tests/e2e/dashboard.spec.ts.todo tests/e2e/dashboard.spec.ts
```

But note: at that point you'll need either real test-user data or assertions
relaxed to work with the empty state.
