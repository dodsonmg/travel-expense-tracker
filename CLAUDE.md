# Travel Expense Tracker

Offline-first PWA to track individual trip expenses by category. No backend,
no accounts, no sync: all data lives on the device in IndexedDB; the only
thing that leaves is a CSV/`.xlsx` the user chooses to export. See `SPEC.md`
for the full product spec — it is the source of truth, read it before
non-trivial changes. `TEST_PLAN.md` tracks test coverage.

Sibling project `../dts-expense-tracker` is the app this was scaffolded from
(same author, same UX conventions). It has DTS reconciliation, M&IE, mileage,
and GTCC/personal payment tracking that this app deliberately does not need —
don't pull those concepts in without being asked.

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b + vite build → dist/
npm run preview    # serve the production build (test the PWA/offline here)
npm run typecheck  # tsc -b --noEmit
npm run gen-icons  # regenerate the app icon (suitcase) in public/
npm run lint       # eslint .
npm test           # vitest run
```

## UI testing

For any UI/frontend change, verify it in a real browser before calling the
task done — don't rely on typecheck/lint/tests alone to confirm the feature
works. Use `.claude/skills/run-travel-expense-tracker/driver.mjs`: a
headless-Chromium (Playwright) REPL driver, run against `npm run dev`. See
the file's header comments for the command vocabulary, invocation (read
commands from a redirected file, not a pipe), and gotchas (e.g. don't
`wait-for #root` — it exists before the IndexedDB load resolves; wait for
something that only renders post-load).

## Architecture

- `src/types.ts` — domain types + the fixed `CATEGORIES` list/order (Transport,
  Accommodation, Food & Dining, Pet Sitting, Entertainment, Misc), `Trip`
  (incl. `budget_usd`, `archived`), `Expense` (incl. `status`),
  `isUsdPending`, `isPlanned`. Single source of truth for the data model.
- `src/db.ts` — IndexedDB load/save, keyed by trip. Global keys hold the
  `trips: Trip[]` registry, the `activeTripId`, and `lastBackup` (a `{ at,
  expenseCount }` snapshot the backup nudge compares against); each trip's
  expenses live under a `trip:<id>:expenses`-prefixed key. `ensureInitialized()`
  runs once on load: a no-op if the registry already exists, otherwise
  migrates the old pre-multi-trip flat `'trip'`/`'expenses'` keys into a trip
  that keeps its original id/name/`budget_usd` (or synthesizes a default trip
  on a genuinely fresh install). Legacy keys are read once and never deleted.
- `src/useTrips.ts` — owns the trip registry: `trips`, `activeTripId`,
  create/rename/delete/select, `setBudget(tripId, category, amount)` (since
  `budget_usd` lives on `Trip`), and `setArchived(id, archived)`. A device
  always has ≥1 trip — `deleteTrip` no-ops on the last remaining one,
  regardless of archived status.
- `src/useTripData.ts` — parameterized by `tripId`; owns just that trip's
  `expenses` (load/save/add/update/delete), reloading whenever the active
  trip changes. `App` composes `useTrips()` + `useTripData(activeTripId)` and
  passes slices down; components are otherwise presentational.
- `src/useAllTripsData.ts` — read-only, cross-trip counterpart to
  `useTripData`: loads every given trip's expenses (keyed by trip id) for the
  Rollup tab and the backup nudge's edit count. Never persists. `App` patches
  in the active trip's live edits via `setExpensesForTrip` so Rollup doesn't
  go stale between trip switches.
- `src/useBackup.ts` — the IO layer for full JSON backup/restore:
  `exportBackup()` does an authoritative fresh read of storage; `restoreBackup
  (rawText)` validates before writing anything (no partial write on a
  malformed file).
- `src/useBackupNudge.ts` — nudges toward a backup only once both a day and
  an edit-count threshold since the last one are crossed; `dismiss()` is
  session-only, `markBackedUp()` resets both baselines.
- `src/lib/` — pure functions, no React:
  - `totals.ts` — by-category totals, grand total, USD-pending counts.
    Actual-only (excludes `status: 'planned'` expenses).
  - `budget.ts` — by-category budget vs. actual vs. planned vs. remaining,
    consumed by `BudgetView` and threaded into `report.ts`; also
    `tripBudgetTotal`/`sumBudgetTotals`, the per-trip/cross-trip figures
    `RollupView` consumes.
  - `backup.ts` — the full JSON backup file format (versioned,
    round-trippable) and its validation — distinct from `report.ts`, which is
    lossy/single-trip/display-oriented.
  - `report.ts` — one structured export model consumed by both exporters, so
    CSV and XLSX never drift.
  - `csv.ts` — CSV export document.
  - `xlsx.ts` — formatted `.xlsx` (ExcelJS, dynamically imported to stay out
    of the main bundle).
  - `share.ts` — `downloadBlob`/`shareBlob` (Web Share API with a download
    fallback), shared by `ExportView` and `BackupPanel`.
  - `format.ts` — currency + date helpers.
  - `pwaRegister.ts` — re-exports `useRegisterSW` from
    `virtual:pwa-register/react`. Exists purely so tests can `vi.mock` a real
    file path; the virtual specifier itself can't be resolved under
    `vitest.config.ts` (no `VitePWA` plugin there), so mocking it directly
    fails at Vite's import-analysis step before `vi.mock` ever applies.
- `src/components/` — one file per screen: `EntryForm`, `ExpenseList`,
  `TotalsView`, `BudgetView`, `RollupView`, `ExportView`, plus `TripSwitcher`
  (the header trip create/rename/switch/delete/archive control — not a tab),
  `UpdateToast`, and `BackupNudgeToast`. `RollupView` shows one budget tile
  per non-archived trip plus a grand total; tapping a tile switches trips and
  jumps to Budget. `BackupPanel` (rendered inside `ExportView`, not a
  separate tab) holds the full backup/restore UI. `App.tsx` is the tab shell
  (Entry/List/Totals/Budget/Rollup/Export); it also mounts `UpdateToast` and
  `BackupNudgeToast`.

## Domain invariants — get these wrong and the tool is misleading

1. **Currencies are never summed together.** GBP and USD stay separate; there
   is no conversion. Every totals row/export keeps both as separate columns.
   **USD is the total that matters** once it's filled in (it's what actually
   got charged) — GBP is a placeholder until then.
2. **"USD pending"** = has a GBP amount but no USD amount (the charge hasn't
   landed on the card yet). Surfaced as a List filter, a Totals flag, and a
   CSV/xlsx column/highlight. `isUsdPending` (`types.ts`) is the single
   definition — don't reimplement the check elsewhere.
2a. **"Planned"** (`status: 'planned'`, `isPlanned` in `types.ts`) = a known
    but unpaid commitment (e.g. a reserved hotel), entered as an ordinary
    `Expense` row with an estimated amount. Undefined `status` means
    `'actual'` (pre-Phase-2 records have no field at all). Planned expenses
    are excluded from `totalsByCategory`/the Totals view/export and only
    count toward the Budget view's PLANNED column — **reconciling** one means
    editing that same row (fill in the real amount, flip to `'actual'`), not
    creating a new row. Budget's ACTUAL/PLANNED USD columns use `amount_usd`
    only — no GBP fallback, per invariant 1.
3. **Category set is fixed, in fixed order** (`CATEGORIES` in `types.ts`):
   Transport, Accommodation, Food & Dining, Pet Sitting, Entertainment, Misc.
   `totalsByCategory` always returns all six rows, even at zero, so the
   Totals view and exports have a stable shape.
4. **Amounts are optional** but an expense needs at least one of GBP/USD to
   save (`EntryForm`'s `canSave`).
5. **Date defaults to today, freely editable.**
6. **Every expense carries a `tripId`, scoping it to one trip.** Multi-trip
   is live (Phase 3 in `SPEC.md`): the header's `TripSwitcher` creates,
   renames, switches, and deletes trips via `useTrips.ts`. A device always
   has at least one trip — `deleteTrip` refuses to delete the last one.
   Switching trips reloads `useTripData`'s `expenses` for the newly active
   `tripId`; it never mixes rows across trips.
7. **No DTS/reconciliation, no M&IE, no mileage calculator, no payment-method
   split.** These are the sibling project's concepts, not this one's. Budget
   vs. actual (Phase 2, invariant 2a) is a self-set comparison, not a
   resurrection of the DTS model.
8. **`budget_usd` lives on `Trip`, not a separate key.** Per-category USD
   ceiling, optional/partial (a category with no entry has no budget set).
   Kept on `Trip` (in the `trips` registry) rather than a standalone record,
   so each trip carries its own budget automatically when switched to;
   `useTrips.setBudget(tripId, category, amount)` is the only place that
   mutates it.
9. **Archiving a trip never deletes its data.** `Trip.archived` just hides it
   from `TripSwitcher`'s default list and from the Rollup tab's totals — it
   stays reachable via "Show archived," remains fully usable if it's the
   active trip, and is orthogonal to `deleteTrip`'s "at least one trip"
   invariant (which counts all trips regardless of archived status).
   `useTrips.setArchived(id, archived)` is the only place that mutates it.

## Export contract

`buildCsv` emits `EXPENSES` rows (date, category, amount_gbp, amount_usd,
usd_pending, planned, note), then `TOTALS BY CATEGORY` (one row per fixed
category, actual-only) plus a `TOTAL` row, then `BUDGET VS ACTUAL` (one row
per category: budget_usd, actual_usd, planned_usd, remaining_usd) plus a
`TOTAL` row. Money cells are plain 2-dp numbers (or blank) — no currency
glyphs.

The formatted `.xlsx` (`buildXlsx`, ExcelJS) renders from the same
`report.ts` model: a **Totals** sheet (USD-pending rows highlighted,
actual-only), a **Budget** sheet (over-budget rows highlighted), then an
**Expenses** sheet (raw rows, USD-pending and planned rows highlighted).
Both exporters must render from `buildReport` so they never diverge. ExcelJS
is dynamically imported; keep it out of any statically-loaded module.

## Backup format

Distinct from the CSV/`.xlsx` exports above, which are lossy, single-trip,
and display-oriented. `lib/backup.ts` defines a full, round-trippable JSON
snapshot (`BackupFileV1`: `format`, `version`, `exportedAt`, `activeTripId`,
`trips`, and `expenses` keyed by trip id) covering every trip on the device.
`useBackup.ts`'s `exportBackup()` always re-reads storage fresh rather than
trusting any in-memory cache; `restoreBackup()` validates before writing
anything, so a malformed file can't cause a partial write. Restoring is a
full replace (not a merge), confirmed via a two-step "can't be undone" card
(same idiom as trip delete) before it overwrites device data and reloads.
`BackupPanel` (inside `ExportView`) is the only UI surface for this;
`BackupNudgeToast` (mirroring `UpdateToast`'s mount point/styling) nudges
toward it once both a day and an edit-count threshold since the last backup
are crossed, resettable via `markBackedUp()`.

## PWA behavior

`registerType: 'autoUpdate'` (`vite.config.ts`) lets a new service worker take
over silently once installed, but a tab already open has no way to know — it
keeps running the old JS in memory until fully closed and relaunched.
`UpdateToast` (mounted once in `App.tsx`, above the tab content) surfaces that
moment via `vite-plugin-pwa`'s `useRegisterSW()` hook (through the
`pwaRegister.ts` indirection, see above).

## Deployment

Static host with HTTPS (GitHub Pages). `vite.config.ts` `base` defaults to
`/travel-expense-tracker/` for GitHub Pages; set `VITE_BASE=/` for a root
deploy (Netlify/custom domain). The PWA must work offline after first load.

The app icon (a suitcase) is generated by `npm run gen-icons`
(`scripts/gen-icons.mjs`): a hand-authored SVG, rasterized at each manifest
size with `sharp` (no browser needed, unlike the Playwright approach in
`dts-expense-tracker`). The maskable variant (`pwa-512x512-maskable.png`) is a
**separate** asset from the "any" icons — its artwork is shrunk into a safe
zone since OS icon masks clip anything near the edges; never point
`purpose: 'maskable'` at the same file as a plain icon.

## Roadmap

MVP (this scaffold) is Phase 1 in `SPEC.md`. Phase 2 is budgeting: a
per-category USD ceiling (`Trip.budget_usd`) plus a `status: 'planned' |
'actual'` field on `Expense` for unpaid commitments, compared on a new Budget
view/export (invariants 2a, 8). Phase 3 (multi-trip) is done — see
invariant 6 and the `db.ts`/`useTrips.ts` bullets above. Phase 4's
backup/restore is done (invariant 9, the Backup format section above); its
other item, receipt photos, is not. Trip archiving + the Rollup tab (also
done) were added beyond the original phased plan — see SPEC.md's Phase 5.
Don't pull receipt photos forward without being asked.
