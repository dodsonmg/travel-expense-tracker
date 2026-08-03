// REPL driver for travel-expense-tracker (Vite + React PWA). Headless
// Chromium via Playwright — no chromium-cli in this environment, so this
// adapts its command vocabulary (nav/wait-for/click/fill/screenshot/console)
// directly against `playwright`'s `chromium` launcher instead.
//
// Run from the project root: node .claude/skills/run-travel-expense-tracker/driver.mjs
// `playwright` must be resolvable from node_modules (it's pulled in
// transitively via @vitest/browser-playwright) — this file must stay inside
// the project tree (or a subdirectory of it) for Node's ESM resolution to
// find it; it will NOT resolve from an out-of-tree scratch/temp directory.
//
// Default launch URL assumes `npm run dev` on Vite's default port (5173)
// with the GitHub Pages base path (`/travel-expense-tracker/`, see
// vite.config.ts). Vite auto-increments the port if 5173 is busy (e.g.
// another project's dev server already running) — pass the actual URL to
// `launch` if so.
//
// Gotcha: don't `wait-for #root` as a readiness signal — the div exists on
// initial mount, before the app's async IndexedDB load resolves, so a
// screenshot taken right after can still show "Loading...". Wait for
// something that only renders post-load instead, e.g. `wait-for select`
// (the Category dropdown) or `wait-for button:has-text("Save")`.
//
// Invocation: reading commands from a redirected file (`node driver.mjs <
// commands.txt`) works and is the simplest mode — write the whole command
// script up front, then read any screenshots afterward. Piping via `cmds |
// node driver.mjs` does NOT work reliably (the /dev/stdin re-open below
// behaves inconsistently with a pipe's fd); use file redirection instead.
import { chromium } from 'playwright';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/travel-expense-tracker-shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

let browser = null;
let page = null;
const consoleErrors = [];

const COMMANDS = {
  async launch(url) {
    if (browser) return console.log('already launched');
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 400, height: 850 } });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(url || 'http://localhost:5173/travel-expense-tracker/');
    console.log('launched:', page.url());
  },

  async nav(url) {
    if (!page) return console.log('ERROR: launch first');
    await page.goto(url);
    console.log('nav ->', page.url());
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f });
    console.log('screenshot:', f);
  },

  async 'wait-for'(sel) {
    if (!page) return console.log('ERROR: launch first');
    try {
      await page.waitForSelector(sel, { timeout: 10_000 });
      console.log('found:', sel);
    } catch {
      console.log('TIMEOUT:', sel);
    }
  },

  // Playwright selector engines work directly: `text=Toast`,
  // `button:has-text("Add")`, `role=button[name="Add"]`, plain CSS, etc.
  // No shell involved — this is a raw stdin line split on whitespace, not a
  // shell command line, so do NOT wrap values in quotes (see Gotchas):
  // `fill textarea Toast` is correct, `fill textarea "Toast"` types the
  // literal quote characters. Playwright's OWN selector syntax (e.g. the
  // quotes inside `:has-text("Add")`) is fine and required, since that's
  // the driver forwarding the string to Playwright's selector engine, not
  // shell quoting.
  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    await page.click(sel, { timeout: 10_000 });
    console.log('click', sel);
  },

  // `fill <selector> <value...>` — value is everything after the first space.
  async fill(args) {
    if (!page) return console.log('ERROR: launch first');
    const sp = args.indexOf(' ');
    const sel = sp === -1 ? args : args.slice(0, sp);
    const value = sp === -1 ? '' : args.slice(sp + 1);
    await page.fill(sel, value, { timeout: 10_000 });
    console.log('fill', sel, '->', value);
  },

  // `select <selector> <value>` — for <select> dropdowns (e.g. category pickers).
  async select(args) {
    if (!page) return console.log('ERROR: launch first');
    const sp = args.indexOf(' ');
    const sel = args.slice(0, sp);
    const value = args.slice(sp + 1);
    await page.selectOption(sel, value, { timeout: 10_000 });
    console.log('select', sel, '->', value);
  },

  async press(key) {
    if (page) await page.keyboard.press(key);
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try {
      console.log(JSON.stringify(await page.evaluate(expr)));
    } catch (e) {
      console.log('ERROR:', e.message);
    }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(
      await page.evaluate(
        (s) => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
        sel || null,
      ),
    );
  },

  // `console --errors` — matches chromium-cli's flag; this driver only
  // tracks errors (not full console log), which is what matters for "did
  // anything throw."
  async console(flag) {
    if (flag === '--errors') {
      console.log(consoleErrors.length ? consoleErrors.join('\n') : '(no errors)');
    } else {
      console.log('usage: console --errors');
    }
  },

  async quit() {
    if (browser) await browser.close().catch(() => {});
    browser = null;
    page = null;
  },

  help() {
    console.log('commands:', Object.keys(COMMANDS).join(', '));
  },
};

const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

// readline's 'line' event does NOT wait for an async handler to resolve
// before firing the next one — without this queue, a slow command (e.g. a
// selector that doesn't match, retrying for its full timeout) lets later
// commands race ahead and execute concurrently against the same page. Every
// line is chained onto `queue` so commands always run one at a time, in order.
let queue = Promise.resolve();
// readline's own 'close' event (stdin EOF) fires as soon as the input file
// is fully read — the Interface is already closed at that point even
// though queued runLine() calls (chained on `queue`) may still be
// in-flight, so any rl.prompt() they call afterward throws
// ERR_USE_AFTER_CLOSE. Guard every prompt call on this flag.
let closed = false;

async function runLine(line) {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (!cmd) return !closed && rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.log('unknown:', cmd, '— try: help');
    return !closed && rl.prompt();
  }
  try {
    await fn(rest.join(' '));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
  if (cmd === 'quit') {
    rl.close();
    process.exit(0);
    return;
  }
  if (!closed) rl.prompt();
}

rl.on('line', (line) => {
  queue = queue.then(() => runLine(line));
});
rl.on('close', async () => {
  closed = true;
  // stdin EOF fires this immediately when input is a redirected file (all
  // lines already queued) — without waiting for `queue` to drain first, a
  // slow in-flight command (e.g. `launch`, which takes a moment to actually
  // start Chromium) gets killed by process.exit() before it ever completes.
  await queue;
  await COMMANDS.quit();
  process.exit(0);
});

console.log('travel-expense-tracker driver — "help" for commands, "launch" to start');
rl.prompt();
