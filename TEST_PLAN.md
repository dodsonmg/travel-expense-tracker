# Travel Expense Tracker — Test Plan

Mirrors `dts-expense-tracker`'s approach: Vitest + Testing Library for the pure
logic and components, plus a manual pass for the PWA/offline behavior that
automated tests can't easily cover. Automated tests run in CI (lint,
typecheck, test, build) on every push/PR.

## 1. Domain / pure logic (`src/types.ts`, `src/lib/*.test.ts`)

### `types.ts`
- `isUsdPending`: true when `amount_gbp` is set and `amount_usd` is null;
  false when both are set, when only USD is set, and when both are null.

### `totals.ts` (by-category totals)
- Empty expense list → every category present with `{ gbp: 0, usd: 0 }` (all
  6 fixed categories appear even with zero expenses, in fixed order).
- Multiple expenses in the same category sum correctly, GBP and USD summed
  independently (never combined with each other).
- An expense with `amount_gbp: null` contributes 0 to the GBP column; same for
  a null `amount_usd`.
- Grand total = sum across all categories, GBP and USD kept separate.
- USD-pending count per category: 0 when no pending expenses; correct count
  when some rows are GBP-only.

### `format.ts`
- `money(null, currency)` renders a placeholder (e.g. "—"), not "NaN" or "$0".
- `money(amount, 'GBP')` and `money(amount, 'USD')` use the correct currency
  symbol/locale and never share a formatter instance's state.
- `today()` returns `YYYY-MM-DD` for the local date, not shifted by timezone
  (test around a UTC offset that would roll the date, e.g. mock a time near
  midnight in a non-UTC timezone).

### `csv.ts`
- Output has an EXPENSES block with one row per expense including
  date/category/gbp/usd/usd_pending/note, followed by a TOTALS BY CATEGORY
  block, followed by a grand total row.
- A note or value containing a comma, quote, or newline is escaped per RFC
  4180 (matches the reference app's `cell()` behavior) — round-trip through a
  CSV parser recovers the original string.
- Null amounts render as blank cells, not "null"/"NaN".
- `csvFilename()` embeds today's date and a stable prefix.

### `xlsx.ts`
- `buildXlsx` produces a workbook with a Totals sheet and an Expenses sheet.
- Round-trip: write the buffer, read it back with ExcelJS, and assert cell
  values match the input expenses (mirrors the reference app's xlsx
  round-trip test) — catches silent formatting/column-order regressions.
- USD-pending rows carry the expected highlight fill; non-pending rows don't.
- Money columns carry a numeric format (`#,##0.00`), not a currency-glyph
  string — the export must reconcile numerically, not just look right.
- `xlsxFilename()` embeds today's date.

### `report.ts` (shared export model, if implemented as a distinct module)
- CSV and XLSX both build from the same `buildReport()` output for a given
  expense list — assert both exporters' totals match the same input rather
  than duplicating totals logic (regression guard against the two formats
  drifting apart).

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
- Persistence is skipped until the initial load completes (guards against the
  empty initial state overwriting real stored data — this was a documented
  invariant in the reference app's `useTripData` and is worth a regression
  test here too).

## 3. Components (Testing Library)

### `EntryForm`
- Cannot submit with both GBP and USD blank (`canSave` false); can submit with
  either one alone.
- "Save & add another": after submit, amounts and note clear; date and
  category persist for the next entry.
- "Save & view list": after submit, the `onDone` callback fires.
- Selecting a category updates the payload's `category` field.
- Amount inputs reject/ignore negative numbers (parity with reference app's
  `parseAmount`).

### `ExpenseList`
- Empty state: "No expenses yet" message when the list is empty.
- Renders one row per expense, newest date first.
- "USD pending only" filter shows only rows missing a USD amount; count badge
  matches the filtered count.
- Clicking a row opens it in edit mode; Save applies the patch and closes
  edit mode; Cancel discards changes; Delete removes the row.
- Editing a row's category, amounts, date, or note round-trips correctly
  through the edit form's local state into the `onUpdate` patch.

### `TotalsView`
- Renders all 6 categories in fixed order even when some have zero expenses.
- GBP and USD columns never show a combined/summed figure.
- A category with a USD-pending expense shows the pending flag/count.
- Grand total row sums correctly across categories.

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
- Entry → List → Totals → Export flow end-to-end in a real mobile viewport:
  add a few expenses across categories (including one GBP-only "pending"
  entry), confirm List/Totals reflect them, export CSV and `.xlsx` and open
  both to confirm the numbers match what the app shows.
- Data survives a full app close/reopen (IndexedDB persistence, not just
  React state).

## 5. CI

`ci.yml` runs `npm run lint`, `npm run typecheck`, `npm test`, and
`npm run build` on push/PR, matching the reference app's pipeline. `deploy.yml`
publishes `dist/` to GitHub Pages on push to `main`.

## Out of scope for this test plan

Budgeting and multi-trip functionality (Phase 2/3 in `SPEC.md`) aren't built
yet, so there's nothing to test. When those land, this plan should grow a
budget-vs-actual section and a trip-switching section rather than being
rewritten from scratch.
