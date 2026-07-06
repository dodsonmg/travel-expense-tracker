import type { Expense } from '../types';
import { buildReport } from './report';

// Hand-rolled CSV (no dependency, per SPEC.md). Excel/Sheets-safe escaping.
function cell(value: string | number | null): string {
  if (value == null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: (string | number | null)[]): string {
  return cells.map(cell).join(',');
}

// Money for the spreadsheet: plain number (2dp) or blank, never a currency
// glyph.
function num(amount: number | null): string {
  return amount == null ? '' : amount.toFixed(2);
}

// One file: raw rows first, then a totals-by-category block, then a grand
// total.
export function buildCsv(expenses: Expense[]): string {
  const report = buildReport(expenses);
  const lines: string[] = [];

  lines.push('EXPENSES');
  lines.push(row(['date', 'category', 'amount_gbp', 'amount_usd', 'usd_pending', 'note']));
  for (const e of report.expenses) {
    lines.push(
      row([
        e.date,
        e.category,
        num(e.amountGbp),
        num(e.amountUsd),
        e.usdPending ? 'yes' : '',
        e.note,
      ]),
    );
  }

  lines.push('');
  lines.push('TOTALS BY CATEGORY');
  lines.push(row(['category', 'gbp', 'usd', 'usd_pending_count']));
  for (const r of report.categories) {
    lines.push(row([r.category, num(r.gbp), num(r.usd), r.usdPendingCount || '']));
  }
  lines.push(row(['TOTAL', num(report.grandTotal.gbp), num(report.grandTotal.usd), '']));

  return lines.join('\r\n');
}

export function csvFilename(now = new Date()): string {
  return `trip-expenses-${now.toISOString().slice(0, 10)}.csv`;
}
