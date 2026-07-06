# Travel Expense Tracker — Specification

A personal, offline-first tool to capture individual expenses during a trip,
grouped into fixed categories, with running totals and a spreadsheet export.
Modeled closely on the sibling project `dts-expense-tracker`, minus everything
specific to DTS reconciliation (no GTCC/personal split, no M&IE, no mileage
calculator, no "entered in DTS" tracking, no DTS-expected-totals input).

## Context & constraints

- **Capture device:** phone, as an installable PWA, usable offline (no signal
  during travel).
- **No backend.** Data lives on the device (IndexedDB via localForage). Nothing
  leaves the device except the CSV/spreadsheet the user chooses to export. No
  accounts, no sync.
- **Single user, single household.** No auth, no multi-user concerns.

## Currency model (no conversion)

Each expense carries **two amount fields, both optional**, same convention as
`dts-expense-tracker`:

- `amount_gbp` — entered at time of purchase; matches the receipt.
- `amount_usd` — backfilled later once the charge registers on the credit
  card.

No automatic conversion between the two. An expense with a GBP amount but no
USD amount yet is **"USD pending."** Totals **never mix currencies** — GBP and
USD are always shown as separate columns — but **USD is the total that
matters**: it's the number that reflects what actually got charged, and it's
what any future budget-vs-actual comparison will be measured against.

An expense needs at least one of GBP/USD to save (same rule as the reference
app).

## Categories (fixed set, fixed order)

1. Transport
2. Accommodation
3. Food & Dining
4. Pet Sitting
5. Entertainment
6. Misc

## Data model

### Trip (hidden in the UI for now)

Every expense belongs to a trip, but the UI does not expose trip
creation/switching yet — there is exactly one implicit trip, auto-created on
first load. This is purely to avoid a data migration when multi-trip support
(Phase 2 below) is added.

| field       | notes                                    |
|-------------|-------------------------------------------|
| `id`        | generated once, on first load              |
| `name`      | placeholder value; not shown in UI yet      |
| `createdAt` | ISO timestamp                               |

### Expense

| field        | notes                                                          |
|--------------|-----------------------------------------------------------------|
| `id`         | generated                                                        |
| `tripId`     | the implicit trip's id; invisible to the user for now            |
| `date`       | defaults to today on entry; freely editable                     |
| `category`   | one of the 6 fixed categories above                              |
| `amount_gbp` | optional                                                         |
| `amount_usd` | optional; backfilled when the charge lands on the card            |
| `note`       | optional (vendor / description)                                  |

No `payment` field (no GTCC-vs-personal concept), no `entered` field (no DTS
to key into), no `miles`/`rate` (no mileage calculator).

## Totals view

One table, by category, in the fixed category order:

- GBP total and USD total per category (never summed together).
- A grand total row (GBP and USD).
- A count of USD-pending expenses per category, surfaced as a flag (e.g. "2
  missing USD") — informational only, since there's no DTS total to compare
  against and therefore no mismatch/match logic like the reference app's
  reconciliation view.

## Screens (MVP)

1. **Entry** — form with a category dropdown, GBP and USD fields side by side,
   editable date defaulting to today, optional note. Optimized for fast
   repeated entry: after save, amounts and note clear but date/category
   persist for the next row (same UX as the reference app).
2. **List** — all expenses for the trip, newest first; editable/deletable
   inline; a "USD pending only" filter.
3. **Totals** — by-category table described above.
4. **Export** — one tap → CSV and/or formatted `.xlsx` (see below).

No Help/FAQ tab in the MVP — there's no DTS-specific domain vocabulary to
teach (no "USD pending vs. incomplete vs. mismatch," no M&IE vs. MILEAGE). If
that turns out to be wrong, add one later.

## Export

Two formats, matching the reference app's approach:

- **CSV** (hand-rolled, no dependency): expense rows, then a totals-by-category
  block (GBP, USD, `usd_pending` count), then a grand total.
- **`.xlsx`** (ExcelJS, dynamically imported to stay out of the main bundle):
  a formatted workbook — a **Totals** sheet (by category, USD-pending rows
  highlighted) followed by an **Expenses** sheet (raw rows). No mismatch
  highlighting (nothing to mismatch against).

Both share one export model (`report.ts`-equivalent) so CSV and XLSX can't
drift from each other, same pattern as the reference app.

Shared via the Web Share API where available (mobile share sheet), with a
plain download fallback — same as the reference app.

## Tech stack

Same as `dts-expense-tracker`, minus what's not needed:

- **Vite + React + TypeScript** (strict).
- **localForage** over IndexedDB for persistence.
- **CSV export** hand-rolled; **`.xlsx` via ExcelJS**, lazy-loaded.
- **PWA** via `vite-plugin-pwa` (installable, offline-first, update toast).
- **Hosting:** GitHub Pages via GitHub Actions (`base: '/travel-expense-tracker/'`).
- No `reconcile.ts`, no `mie.ts`/`mileage.ts`, no DTS-expected-totals storage.

## Phased plan

**Phase 1 — MVP (this spec)**
1. Expense entry (date, category, GBP, USD, note).
2. List with edit/delete and a USD-pending filter.
3. Totals by category (GBP/USD separate, USD-pending flagged).
4. CSV + `.xlsx` export; local persistence (IndexedDB); installable PWA.
5. Data model carries a hidden `tripId` on every expense so Phase 3 doesn't
   need a migration.

**Phase 2 — budgeting**
6. Pre-trip budget entry, per category (USD, since that's the total that
   matters once cards settle).
7. Budget-vs-actual comparison on the Totals view (and export), analogous in
   spirit to the reference app's DTS reconciliation but comparing against a
   budget you set yourself rather than a third-party system.

**Phase 3 — multi-trip**
8. Trip creation/switching UI (the `tripId` plumbing from Phase 1 makes this
   additive, not a migration).
9. Per-trip budgets and exports; a trip list/summary view.

**Phase 4 — nice-to-haves (not committed)**
10. Backup/restore all data as a file.
11. Receipt photos.
