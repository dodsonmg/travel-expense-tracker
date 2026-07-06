# Travel Expense Tracker

An offline-first PWA for tracking individual trip expenses by category —
Transport, Accommodation, Food & Dining, Pet Sitting, Entertainment, Misc.

No backend, no accounts, no sync. All data lives on the device (IndexedDB);
the only thing that leaves is a CSV/`.xlsx` you choose to export. See
[`SPEC.md`](./SPEC.md) for the full product spec and [`TEST_PLAN.md`](./TEST_PLAN.md)
for test coverage.

## Features

- **Fast expense entry** — category dropdown, GBP and USD side by side, date
  defaulting to today but freely editable, optional note.
- **Dual currency, no conversion** — GBP (receipt) and USD (once the charge
  lands on the card) are tracked separately and **never summed together**. An
  expense with GBP but no USD yet is flagged **"USD pending."** USD is the
  total that matters once it's filled in.
- **Totals by category** — GBP/USD kept separate, USD-pending rows flagged, a
  grand total row.
- **Exports** — a formatted **`.xlsx`** (ExcelJS) with a totals sheet (pending
  rows highlighted) plus raw rows, and a plain **CSV**. Shared via the Web
  Share API where available, or downloaded.
- **Installable & offline** — "Add to Home Screen"; works with no signal
  after first load. A dismissible toast surfaces update/offline-ready status.

## Tech stack

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript (strict)
- [localForage](https://localforage.github.io/localForage/) over IndexedDB
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (service worker, manifest)
- CSV export is hand-rolled (no dependency); `.xlsx` via
  [ExcelJS](https://github.com/exceljs/exceljs), lazy-loaded and precached
- [Vitest](https://vitest.dev) + Testing Library, ESLint (flat config)

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173/travel-expense-tracker/
```

The app is best viewed in a mobile viewport (Chrome/Safari DevTools device
mode). Data persists across reloads via IndexedDB.

### Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Serve the production build (test PWA/offline here) |
| `npm run typecheck` | `tsc` without emitting |
| `npm run lint` | ESLint over the project |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run coverage` | Test coverage report |
| `npm run gen-icons` | Regenerate the app icon (suitcase) |

> **PWA note:** the service worker only runs against a built app. To test
> install/offline behavior, run `npm run build && npm run preview` and open it
> on the phone (localhost or HTTPS).

## Project structure

```
src/
  types.ts          Domain model + fixed category set; isUsdPending
  db.ts             IndexedDB load/save (localForage); creates the hidden
                     default trip once, on first load
  useTripData.ts    The one stateful hook (loads once, mirrors to IndexedDB)
  lib/              Pure logic, no React — unit-tested
    totals.ts       By-category totals + grand total (GBP & USD separate)
    report.ts       Shared export model consumed by both exporters
    csv.ts          CSV export
    xlsx.ts         Formatted .xlsx export (ExcelJS, dynamically imported)
    format.ts       Currency + date helpers
  components/       One file per screen (Entry, List, Totals, Export)
                    + UpdateToast (update/offline-ready banner)
  App.tsx           Tab shell
scripts/gen-icons.mjs  Rasterizes the suitcase SVG to every icon size (sharp)
```

The domain invariants (currencies never summed, fixed category order, USD
pending) are documented in [`CLAUDE.md`](./CLAUDE.md) and covered by tests in
`src/lib` and `src/*.test.ts`.

## Testing

```bash
npm test          # unit tests for the lib layer + component tests
npm run coverage
```

See [`TEST_PLAN.md`](./TEST_PLAN.md) for the full coverage plan, including the
manual PWA/offline verification pass.

## Deployment

Deployed to **GitHub Pages** via GitHub Actions on every push to `main`.
`vite.config.ts` sets `base` to `/travel-expense-tracker/` for Pages; set
`VITE_BASE=/` for a root deploy (Netlify / custom domain):

```bash
VITE_BASE=/ npm run build
```

CI (`.github/workflows/ci.yml`) runs lint, type-check, tests, and build on
pushes and PRs; `deploy.yml` publishes `dist/` to Pages.

The app icon is regenerated with `npm run gen-icons` (`scripts/gen-icons.mjs`,
using `sharp` — no browser needed).

## Roadmap

MVP (this scaffold) is Phase 1 in [`SPEC.md`](./SPEC.md). Remaining phases:

- **Phase 2 — budgeting:** pre-trip budget per category, budget-vs-actual view.
- **Phase 3 — multi-trip:** trip creation/switching UI (every expense already
  carries a hidden `tripId`, so this is additive, not a migration).
- **Phase 4 — nice-to-haves:** backup/restore, receipt photos.

Don't pull that work forward without being asked.
