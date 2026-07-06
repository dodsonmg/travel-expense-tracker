import type { Category, Expense } from '../types';
import { buildReport } from './report';
import { slugify } from './format';

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

// One file: raw rows first, then a totals-by-category block (actual spend
// only), then a grand total, then a budget-vs-actual block.
export function buildCsv(
  expenses: Expense[],
  budget: Partial<Record<Category, number>> = {},
): string {
  const report = buildReport(expenses, budget);
  const lines: string[] = [];

  lines.push('EXPENSES');
  lines.push(
    row(['date', 'category', 'amount_gbp', 'amount_usd', 'usd_pending', 'planned', 'note']),
  );
  for (const e of report.expenses) {
    lines.push(
      row([
        e.date,
        e.category,
        num(e.amountGbp),
        num(e.amountUsd),
        e.usdPending ? 'yes' : '',
        e.planned ? 'yes' : '',
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

  lines.push('');
  lines.push('BUDGET VS ACTUAL');
  lines.push(row(['category', 'budget_usd', 'actual_usd', 'planned_usd', 'remaining_usd']));
  for (const b of report.budget) {
    lines.push(
      row([b.category, num(b.budgetUsd), num(b.actualUsd), num(b.plannedUsd), num(b.remainingUsd)]),
    );
  }
  lines.push(
    row([
      'TOTAL',
      num(report.budgetTotal.budgetUsd),
      num(report.budgetTotal.actualUsd),
      num(report.budgetTotal.plannedUsd),
      num(report.budgetTotal.remainingUsd),
    ]),
  );

  return lines.join('\r\n');
}

export function csvFilename(tripName: string, now = new Date()): string {
  return `trip-expenses-${slugify(tripName)}-${now.toISOString().slice(0, 10)}.csv`;
}
