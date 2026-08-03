---
name: run-travel-expense-tracker
description: Build, run, and visually verify the travel-expense-tracker Vite/React PWA. Use when asked to start travel-expense-tracker, take a screenshot of it, or click through/verify a UI change (Entry, List, Totals, Budget, Rollup, Export tabs).
---

travel-expense-tracker is a Vite + React PWA with no server-side component —
"running" it means starting the Vite dev server and driving a headless
Chromium against it. There's no `chromium-cli` in this environment, so drive
it via the Playwright REPL at
`.claude/skills/run-travel-expense-tracker/driver.mjs` instead — it mirrors
`chromium-cli`'s command vocabulary (`nav`, `wait-for`, `click`, `fill`,
`ss`, `console --errors`) directly against Playwright's `chromium`
launcher.

All paths below are relative to the repo root
(`travel-expense-tracker/`).

## Prerequisites

`playwright` already resolves from `node_modules` (pulled in transitively
via `@vitest/browser-playwright`), and its Chromium binary is already
launchable — verified in this session with a direct `chromium.launch()`
smoke test. No separate install step needed, unlike a project where
`playwright` isn't already present at all (see food-diary's
`run-food-diary` skill for that case: `npm install --no-save
--no-package-lock playwright@<version>`).

## Run (agent path)

Start the dev server, then the driver, in the project root:

```bash
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill   # free the port if a prior run is still up
nohup npm run dev -- --strictPort --port 5173 > /tmp/tet-dev.log 2>&1 &
disown
until curl -sf http://localhost:5173/travel-expense-tracker/ >/dev/null; do sleep 0.5; done
node .claude/skills/run-travel-expense-tracker/driver.mjs
```

(Note: `timeout` is not available in this environment's shell — use a
polling loop like the `until curl ...` above, not `timeout N bash -c
'until ...'`.)

For iterative/agent use, wrap the driver in tmux:

```bash
tmux new-session -d -s tet -x 200 -y 50
tmux send-keys -t tet 'cd /path/to/travel-expense-tracker && node .claude/skills/run-travel-expense-tracker/driver.mjs' Enter
i=0; while [ $i -lt 20 ]; do tmux capture-pane -t tet -p | grep -q "driver>" && break; sleep 0.5; i=$((i+1)); done
tmux send-keys -t tet 'launch' Enter
i=0; while [ $i -lt 20 ]; do tmux capture-pane -t tet -p | grep -q "launched:" && break; sleep 0.5; i=$((i+1)); done
tmux send-keys -t tet 'ss 01-landing' Enter
tmux capture-pane -t tet -p
```

Screenshots land in `/tmp/travel-expense-tracker-shots/` (override:
`SCREENSHOT_DIR`).

### Commands

| command | what it does |
|---|---|
| `launch [url]` | launch headless Chromium, open a page (defaults to `http://localhost:5173/travel-expense-tracker/`) |
| `nav <url>` | navigate the current page |
| `ss [name]` | screenshot → `/tmp/travel-expense-tracker-shots/<name>.png` |
| `wait-for <selector>` | wait up to 10s for a selector (Playwright selector syntax — `text=Foo`, CSS, etc.) |
| `click <selector>` | click, e.g. `click button:has-text("Save & view list")` |
| `fill <selector> <value...>` | fill an input/textarea — value is everything after the first space, **no quotes** (see Gotchas) |
| `select <selector> <value>` | pick a `<select>` option, e.g. the Category dropdown |
| `press <key>` | keyboard press, e.g. `press Enter` |
| `eval <js>` | `page.evaluate`, prints JSON |
| `text [selector]` | print `innerText` (body if no selector) |
| `console --errors` | print any page/console errors seen so far |
| `quit` | close the browser, exit |

Verified this session, full round trip: `launch` → `fill
input[placeholder="0.00"] 42.50` (GBP amount) → `fill
input[placeholder="optional"] Taxi to airport` (note) → `click
button:has-text("Save & view list")` correctly adds the expense and
switches to the List tab, where it renders with the right category/amount/
note. `wait-for`/`ss`/`text`/`console --errors`/`quit` all confirmed
working too, with zero console errors at any step. Note the GBP/USD amount
fields and the note field are plain `<input>`s with `placeholder` text
(`0.00`/`pending`/`optional`), not `id`s and not `<textarea>` — target them
by placeholder, not by guessing an id or element type.

## Run (human path)

```bash
npm run dev   # http://localhost:5173/travel-expense-tracker/ (or the port Vite picks); Ctrl-C to stop
```

## Test

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`npm test` is Vitest (component/unit tests) — this Playwright driver is
for visual/interaction verification on top of that, not a replacement.

---

## Gotchas

- **No shell quoting in driver commands.** Lines typed at `driver>` (or
  sent via `tmux send-keys`) are split on whitespace only — there's no
  shell to strip quotes. `fill input[placeholder="optional"] Taxi to
  airport` is correct; wrapping the value itself in quotes types the
  literal quote characters. Playwright's own selector syntax (the quotes
  inside `button:has-text("Save & view list")` or
  `input[placeholder="optional"]`) is fine — those are consumed by
  Playwright's selector engine, not the driver's line parser.
- **Commands are serialized on purpose.** `readline`'s `'line'` event
  fires for every line immediately, without waiting for the previous async
  handler to finish — without the driver's `queue` promise chain, a slow
  command (e.g. a selector that doesn't match, retrying for its full
  timeout) would let later commands race ahead and fire concurrently
  against the same page. Keep that queue if you modify the driver.
- **The `close` race on piped/redirected stdin.** If stdin is a file or
  heredoc rather than an interactive terminal, `readline`'s `'close'`
  event (EOF) fires as soon as all lines have been *read*, not once
  they've finished *running* — since commands are queued (previous
  bullet), a `close` handler that calls `process.exit()` immediately can
  kill an in-flight `launch` before Chromium has actually started. The
  driver's `close` handler `await`s the queue before quitting/exiting;
  keep that if you modify it.
- **`timeout` is not available in this shell** (macOS, no coreutils). Use
  a manual poll loop (`i=0; while [ $i -lt N ]; do ...; sleep 0.5; i=$((i+1));
  done`) instead of `timeout N bash -c 'until ...; done'`.
- **The driver script must live inside the project tree.** Node's ESM
  `import { chromium } from 'playwright'` resolves relative to the
  importing file's own location, not the shell's cwd — a copy of the
  driver placed in an out-of-tree scratch/temp directory fails with
  `ERR_MODULE_NOT_FOUND` even when run with `cwd` set to the project root.
- **`npm run dev &` alone isn't enough to stop it later** — `$!` after
  that is the `npm` wrapper's PID, and npm doesn't forward signals to the
  Vite process it spawns. Stop via the port instead: `lsof -ti:5173
  -sTCP:LISTEN | xargs -r kill`.

## Troubleshooting

- **`ERR_MODULE_NOT_FOUND: playwright`**: shouldn't happen here (it's
  already resolvable via `@vitest/browser-playwright`) — if it does, the
  driver file is probably running from outside the project tree, see
  Gotchas.
- **`EADDRINUSE` on port 5173**: a previous dev server is still up —
  `lsof -ti:5173 -sTCP:LISTEN | xargs -r kill` before relaunching.
