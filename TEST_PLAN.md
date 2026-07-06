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
- `csvFilename(tripName)` embeds today's date, a stable prefix, and a
  slugified version of the trip name; a blank trip name falls back to a
  `trip` placeholder segment rather than an empty one.

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
- `xlsxFilename(tripName)` embeds today's date and a slugified trip name
  (same blank-name fallback as `csvFilename`).
- The Totals sheet's title row folds in the trip name when one is passed
  (e.g. "Bali 2027 — Expense Totals"), falling back to the generic "Trip
  Expense Totals" when it isn't.

### `report.ts` (shared export model)
- CSV and XLSX both build from the same `buildReport()` output for a given
  expense list — assert both exporters' totals match the same input rather
  than duplicating totals logic (regression guard against the two formats
  drifting apart).
- `buildReport(expenses, budget)` carries a `planned` flag per expense row,
  actual-only category totals, and a `budget`/`budgetTotal` section computed
  via `budget.ts`.

## 2. Persistence (`db.ts`, `useTripData.ts`)

- `loadExpenses(tripId)` on an empty store returns `[]`; after
  `saveExpenses(tripId, ...)`, a fresh `loadExpenses(tripId)` round-trips the
  same data, scoped to that trip only (see §6 for cross-trip isolation and
  the migration path — both now live in `db.ts`/`useTrips.ts`).
- `useTripData(tripId)`: initial state is `loaded: false`; after the load
  effect resolves, `loaded: true` and `expenses` reflect that trip's storage.
  Switching `tripId` (e.g. via the trip switcher) re-triggers the load effect
  and swaps in the new trip's expenses without leaking the old trip's rows.
- `addExpense` assigns a generated `id` and the active `tripId`, prepends to
  the list (newest-first ordering matches the List screen's expectation).
- `updateExpense` patches only the targeted row; other rows are unchanged
  (reference equality preserved for untouched objects, to avoid pointless
  re-renders).
- `deleteExpense` removes only the targeted row.
- Persistence is skipped until the initial load completes (guards against the
  empty initial state overwriting real stored data) — covers `saveExpenses`.
  `budget_usd` persistence (`setBudget`) has moved to `useTrips` — see §6.

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
  the expected filename pattern, including the active trip's (slugified)
  name via the `tripName` prop.
- Share path (Web Share API present) attempts `navigator.share`; falls back to
  download if `canShare` is false or `share()` rejects (user cancels).
- Busy state disables buttons during async `.xlsx` generation and clears
  after success or failure; a failed export shows an error message rather
  than throwing.

## 4. Trip switching (`db.ts`, `useTrips.ts`, `TripSwitcher`)

### `db.ts` — `ensureInitialized` migration
- Fresh install (no keys at all): synthesizes one default trip (`My Trip`)
  with empty expenses; `trips` has length 1 and `activeTripId` matches it.
- Legacy single-trip upgrade: seed the old flat `'trip'`/`'expenses'` keys
  directly, then call `ensureInitialized()` — the resulting trip preserves
  the legacy trip's `id`/`name`/`createdAt`/`budget_usd` exactly, and its
  expenses move under the new `trip:<id>:expenses` key without loss. Legacy
  keys are still present afterward (never deleted).
- Idempotency: calling `ensureInitialized()` a second time returns the same
  `trips`/`activeTripId`, doesn't re-migrate or duplicate anything.
- `activeTripId` resolution: falls back to `trips[0].id` when never saved;
  honors a previously saved id across multiple trips.

### Per-trip storage isolation
- `saveExpenses('t1', ...)` / `saveExpenses('t2', ...)` never leak into each
  other; `deleteTripStorage(tripId)` removes only that trip's expenses key,
  leaving other trips' data intact.

### `useTrips`
- Auto-creates one trip on first load (mirrors the `ensureInitialized` fresh
  install case, exercised through the hook).
- `createTrip(name)` appends a new trip, switches `activeTripId` to it, and
  trims/defaults a blank name to "New trip".
- `renameTrip(id, name)` patches only the targeted trip's name; a blank
  rename leaves the existing name untouched.
- `deleteTrip(id)` refuses when it's the last remaining trip (no-op, no
  storage call); deleting the active trip reassigns `activeTripId` to a
  remaining trip; deleting a non-active trip leaves `activeTripId` untouched.
- `setBudget(tripId, category, amount)` patches only the targeted trip's
  `budget_usd`; `amount: null` clears a category's entry; other trips'
  budgets are unaffected.

### `TripSwitcher` component
- Closed by default, showing the active trip's name on the toggle button.
- Opening the panel lists every trip; selecting a non-active one calls
  `onSelect` and closes the panel.
- Rename flow: clicking "Rename" swaps the row for a text input pre-filled
  with the current name; "Save" calls `onRename`, "Cancel" discards.
- Create flow: "＋ New trip" reveals a name input; "Create" calls `onCreate`
  with the entered value.
- Delete requires a second confirmation step (a "can't be undone" card) before
  calling `onDelete`; the initial "Delete" click alone must not call it.
- Delete is disabled (with an explanatory tooltip) when only one trip exists.

## 5. Manual / PWA verification (not automatable, or not worth automating)

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
- Multi-trip end-to-end in a real mobile viewport: create a second trip via
  the header switcher, confirm Entry/List/Totals/Budget/Export all show that
  trip's (empty) data; switch back to the first trip and confirm its
  expenses/budget are intact; rename a trip; attempt to delete down to one
  trip and confirm the last one can't be deleted; export from two different
  trips and confirm distinct filenames and `.xlsx` Totals sheet titles.
- Load the app with data seeded under the old pre-multi-trip flat keys (e.g.
  via devtools IndexedDB) and confirm `ensureInitialized` migrates it into
  trip #1 without data loss.

## 6. CI

`ci.yml` runs `npm run lint`, `npm run typecheck`, `npm test`, and
`npm run build` on push/PR, matching the reference app's pipeline. `deploy.yml`
publishes `dist/` to GitHub Pages on push to `main`.
