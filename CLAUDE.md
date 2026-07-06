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

## Architecture

- `src/types.ts` — domain types + the fixed `CATEGORIES` list/order (Transport,
  Accommodation, Food & Dining, Pet Sitting, Entertainment, Misc), `Trip`,
  `Expense`, `isUsdPending`. Single source of truth for the data model.
- `src/db.ts` — IndexedDB load/save for expenses; `loadOrCreateTrip` creates
  the one hidden default trip on first run and reuses it afterward.
- `src/useTripData.ts` — the one stateful hook: loads once, mirrors state to
  IndexedDB, exposes add/update/delete for expenses. `App` owns it and passes
  slices down; components are otherwise presentational.
- `src/lib/` — pure functions, no React:
  - `totals.ts` — by-category totals, grand total, USD-pending counts.
  - `report.ts` — one structured export model consumed by both exporters, so
    CSV and XLSX never drift.
  - `csv.ts` — CSV export document.
  - `xlsx.ts` — formatted `.xlsx` (ExcelJS, dynamically imported to stay out
    of the main bundle).
  - `format.ts` — currency + date helpers.
  - `pwaRegister.ts` — re-exports `useRegisterSW` from
    `virtual:pwa-register/react`. Exists purely so tests can `vi.mock` a real
    file path; the virtual specifier itself can't be resolved under
    `vitest.config.ts` (no `VitePWA` plugin there), so mocking it directly
    fails at Vite's import-analysis step before `vi.mock` ever applies.
- `src/components/` — one file per screen: `EntryForm`, `ExpenseList`,
  `TotalsView`, `ExportView`. `App.tsx` is the tab shell; it also mounts
  `UpdateToast`.

## Domain invariants — get these wrong and the tool is misleading

1. **Currencies are never summed together.** GBP and USD stay separate; there
   is no conversion. Every totals row/export keeps both as separate columns.
   **USD is the total that matters** once it's filled in (it's what actually
   got charged) — GBP is a placeholder until then.
2. **"USD pending"** = has a GBP amount but no USD amount (the charge hasn't
   landed on the card yet). Surfaced as a List filter, a Totals flag, and a
   CSV/xlsx column/highlight. `isUsdPending` (`types.ts`) is the single
   definition — don't reimplement the check elsewhere.
3. **Category set is fixed, in fixed order** (`CATEGORIES` in `types.ts`):
   Transport, Accommodation, Food & Dining, Pet Sitting, Entertainment, Misc.
   `totalsByCategory` always returns all six rows, even at zero, so the
   Totals view and exports have a stable shape.
4. **Amounts are optional** but an expense needs at least one of GBP/USD to
   save (`EntryForm`'s `canSave`).
5. **Date defaults to today, freely editable.**
6. **Every expense carries a hidden `tripId`.** There is exactly one trip,
   auto-created by `loadOrCreateTrip` on first load; the UI has no
   trip-switching yet (Phase 3 in `SPEC.md`). This exists purely so
   multi-trip support later is additive, not a data migration — don't add
   trip-switching UI without being asked, and don't remove `tripId` from the
   model even though nothing reads it today.
7. **No DTS/reconciliation, no M&IE, no mileage calculator, no payment-method
   split.** These are the sibling project's concepts, not this one's. If
   asked to add reconciliation-style features, treat it as new scope (likely
   Phase 2's budget-vs-actual, not a resurrection of the DTS model).

## Export contract

`buildCsv` emits `EXPENSES` rows (date, category, amount_gbp, amount_usd,
usd_pending, note), then `TOTALS BY CATEGORY` (one row per fixed category)
plus a `TOTAL` row. Money cells are plain 2-dp numbers (or blank) — no
currency glyphs.

The formatted `.xlsx` (`buildXlsx`, ExcelJS) renders from the same
`report.ts` model: a **Totals** sheet (USD-pending rows highlighted) then an
**Expenses** sheet (raw rows, USD-pending rows highlighted). Both exporters
must render from `buildReport` so they never diverge. ExcelJS is dynamically
imported; keep it out of any statically-loaded module.

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

MVP (this scaffold) is Phase 1 in `SPEC.md`. Phase 2 is budgeting
(pre-trip budget per category, budget-vs-actual comparison). Phase 3 is
multi-trip (trip creation/switching UI — the `tripId` plumbing from Phase 1
makes this additive). Phase 4 is backup/restore and receipt photos. Don't
pull that work forward without being asked.
