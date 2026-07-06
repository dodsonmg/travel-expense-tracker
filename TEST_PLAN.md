# Travel Expense Tracker — Test Plan

Mirrors `dts-expense-tracker`'s approach: Vitest + Testing Library for the pure
logic and components, plus a manual pass for the PWA/offline behavior that
automated tests can't easily cover. Automated tests run in CI (lint,
typecheck, test, build) on every push/PR.

## 1. Domain / pure logic (`src/types.ts`, `src/lib/*.test.ts`)

### `types.ts`
- `isUsdPending`: true when `amount_gbp` is set and `amount_usd` is null;
  false when both are set, when only USD is set, and when both are null.
- `isPlanned`: false when `status` is undefined (pre-Phase-2 records) or
  `'actual'`; true when `status` is `'planned'`.

### `totals.ts` (by-category totals, actual spend only)
- Empty expense list → every category present with `{ gbp: 0, usd: 0 }` (all
  6 fixed categories appear even with zero expenses, in fixed order).
- Multiple expenses in the same category sum correctly, GBP and USD summed
  independently (never combined with each other).
- An expense with `amount_gbp: null` contributes 0 to the GBP column; same for
  a null `amount_usd`.
- Grand total = sum across all categories, GBP and USD kept separate.
- USD-pending count per category: 0 when no pending expenses; correct count
  when some rows are GBP-only.
- A planned/reserved expense (`status: 'planned'`) is excluded from both the
  category row and the USD-pending count — it doesn't count as spend until
  reconciled to `'actual'`.

### `budget.ts` (budget vs. actual vs. planned, by category)
- Empty expense list and empty budget map → every category present with
  `budgetUsd/actualUsd/plannedUsd/remainingUsd` all `0`, in fixed order.
- Actual (`status: 'actual'` or undefined) and planned (`status: 'planned'`)
  amounts accumulate into separate columns for the same category.
- No GBP fallback: an expense with `amount_usd: null` contributes `0` to
  either column regardless of `amount_gbp` or status.
- A category with no budget entry shows `budgetUsd: 0` and goes negative
  (`remainingUsd < 0`) as soon as anything is spent/planned against it.
- `budgetGrandTotal` sums budget/actual/planned/remaining across all
  categories.

### `format.ts`
- `money(null, currency)` renders a placeholder (e.g. "—"), not "NaN" or "$0".
- `money(amount, 'GBP')` and `money(amount, 'USD')` use the correct currency
  symbol/locale and never share a formatter instance's state.
- `today()` returns `YYYY-MM-DD` for the local date, not shifted by timezone
  (test around a UTC offset that would roll the date, e.g. mock a time near
  midnight in a non-UTC timezone).

### `csv.ts`
- Output has an EXPENSES block with one row per expense including
  date/category/gbp/usd/usd_pending/planned/note, followed by a TOTALS BY
  CATEGORY block (actual spend only), a grand total row, then a BUDGET VS
  ACTUAL block (one row per category: budget_usd/actual_usd/planned_usd/
  remaining_usd) plus a TOTAL row.
- A note or value containing a comma, quote, or newline is escaped per RFC
  4180 (matches the reference app's `cell()` behavior) — round-trip through a
  CSV parser recovers the original string.
- Null amounts render as blank cells, not "null"/"NaN".
- A planned/reserved expense row is flagged in the `planned` column and
  excluded from the TOTALS BY CATEGORY block.
- `csvFilename()` embeds today's date and a stable prefix.

### `xlsx.ts`
- `buildXlsx` produces a workbook with a Totals sheet, a Budget sheet, and an
  Expenses sheet, in that order.
- Round-trip: write the buffer, read it back with ExcelJS, and assert cell
  values match the input expenses (mirrors the reference app's xlsx
  round-trip test) — catches silent formatting/column-order regressions.
- USD-pending rows carry the expected highlight fill; non-pending rows don't.
- Planned expense rows carry a distinct highlight from USD-pending rows on
  the Expenses sheet.
- The Budget sheet renders budget/actual/planned/remaining per category plus
  a grand total row; over-budget categories (`remaining < 0`) are
  highlighted.
- Money columns carry a numeric format (`#,##0.00`), not a currency-glyph
  string — the export must reconcile numerically, not just look right.
- `xlsxFilename()` embeds today's date.

### `report.ts` (shared export model)
- CSV and XLSX both build from the same `buildReport()` output for a given
  expense list — assert both exporters' totals match the same input rather
  than duplicating totals logic (regression guard against the two formats
  drifting apart).
- `buildReport(expenses, budget)` carries a `planned` flag per expense row,
  actual-only category totals, and a `budget`/`budgetTotal` section computed
  via `budget.ts`.

## 2. Persistence (`db.ts`, `useTripData.ts`)

- `loadExpenses()` on an empty store returns `[]`; after `saveExpenses`, a
  fresh `loadExpenses()` round-trips the same data.
- A hidden default trip is created exactly once on first load (no `tripId` in
  storage yet) and reused on subsequent loads (no duplicate trips created on
  every app open).
- `useTripData`: initial state is `loaded: false`; after the load effect
  resolves, `loaded: true` and `expenses`/trip data reflect storage.
- `addExpense` assigns a generated `id` and the hidden trip's `tripId`,
  prepends to the list (newest-first ordering matches the List screen's
  expectation).
- `updateExpense` patches only the targeted row; other rows are unchanged
  (reference equality preserved for untouched objects, to avoid pointless
  re-renders).
- `deleteExpense` removes only the targeted row.
- `setBudget(category, amount)` sets/updates the trip's `budget_usd` map;
  `setBudget(category, null)` clears a category's entry entirely.
- Persistence is skipped until the initial load completes (guards against the
  empty initial state overwriting real stored data — this was a documented
  invariant in the reference app's `useTripData` and is worth a regression
  test here too) — covers both `saveExpenses` and the newer `saveTrip` (fired
  when the budget map changes).

## 3. Components (Testing Library)

### `EntryForm`
- Cannot submit with both GBP and USD blank (`canSave` false); can submit with
  either one alone.
- "Save & add another": after submit, amounts and note clear; date and
  category persist for the next entry; the "reserved / not yet paid"
  checkbox resets to unchecked.
- "Save & view list": after submit, the `onDone` callback fires.
- Selecting a category updates the payload's `category` field.
- Amount inputs reject/ignore negative numbers (parity with reference app's
  `parseAmount`).
- Default submission carries `status: 'actual'`; checking "reserved / not yet
  paid" submits `status: 'planned'`.

### `ExpenseList`
- Empty state: "No expenses yet" message when the list is empty.
- Renders one row per expense, newest date first.
- "USD pending only" filter shows only rows missing a USD amount; count badge
  matches the filtered count.
- "Planned only" filter shows only planned/reserved rows; count badge matches;
  a planned row shows a "Planned" badge distinct from "USD pending".
- Clicking a row opens it in edit mode; Save applies the patch and closes
  edit mode; Cancel discards changes; Delete removes the row.
- Editing a row's category, amounts, date, note, or planned/reserved status
  round-trips correctly through the edit form's local state into the
  `onUpdate` patch.

### `TotalsView`
- Renders all 6 categories in fixed order even when some have zero expenses.
- GBP and USD columns never show a combined/summed figure.
- A category with a USD-pending expense shows the pending flag/count.
- Grand total row sums correctly across categories.
- A planned/reserved expense doesn't inflate any category's total or the
  grand total (see `totals.ts` above).

### `BudgetView`
- Renders all 6 categories in fixed order even with no budgets/expenses.
- Actual and planned spend show in separate columns for the same category.
- Editing a category's budget input calls `onSetBudget` with the parsed
  amount (blank/negative → `null`, same parsing rule as `EntryForm`).
- A category where `remaining < 0` shows an "over budget" flag; a category
  within budget doesn't.
- Grand total row sums budget/actual/planned/remaining across categories.

### `ExportView`
- Export buttons disabled when there are zero expenses.
- Clicking "Download CSV" / "Download .xlsx" triggers a blob download with
  the expected filename pattern.
- Share path (Web Share API present) attempts `navigator.share`; falls back to
  download if `canShare` is false or `share()` rejects (user cancels).
- Busy state disables buttons during async `.xlsx` generation and clears
  after success or failure; a failed export shows an error message rather
  than throwing.

## 4. Manual / PWA verification (not automatable, or not worth automating)

Run via `npm run build && npm run preview` (service worker only runs against
a built app):

- Install to home screen (iOS/Android) and confirm the app opens standalone,
  offline, after first load.
- Kill network, reload: app still loads and existing data is intact.
- Deploy a change, revisit an already-open tab: "Update available" toast
  appears; Reload applies it.
- First install: "Ready to work offline" toast appears once.
- Entry → List → Totals → Budget → Export flow end-to-end in a real mobile
  viewport: set a category budget, add a few expenses across categories
  (including one GBP-only "pending" entry and one planned/reserved entry),
  confirm List/Totals/Budget reflect them correctly, reconcile the planned
  entry (edit it to fill in the real amount and flip to actual) and confirm
  it moves from Budget's PLANNED to ACTUAL column and starts counting on
  Totals, then export CSV and `.xlsx` and open both to confirm the numbers
  match what the app shows.
- Data survives a full app close/reopen (IndexedDB persistence, not just
  React state).

## 5. CI

`ci.yml` runs `npm run lint`, `npm run typecheck`, `npm test`, and
`npm run build` on push/PR, matching the reference app's pipeline. `deploy.yml`
publishes `dist/` to GitHub Pages on push to `main`.

## Out of scope for this test plan

Multi-trip functionality (Phase 3 in `SPEC.md`) isn't built yet, so there's
nothing to test. When it lands, this plan should grow a trip-switching
section rather than being rewritten from scratch.
