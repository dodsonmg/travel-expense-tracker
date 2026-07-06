import { CATEGORIES, isUsdPending, type Category, type Expense } from '../types';

// A GBP/USD pair. The two currencies are NEVER summed together (SPEC.md):
// every totals row keeps them in separate columns.
export interface CurrencyPair {
  gbp: number;
  usd: number;
}

export interface CategoryRow extends CurrencyPair {
  category: Category;
}

const zero = (): CurrencyPair => ({ gbp: 0, usd: 0 });

// Totals by category, in the fixed category order.
export function totalsByCategory(expenses: Expense[]): CategoryRow[] {
  const acc = new Map<Category, CurrencyPair>(
    CATEGORIES.map((c) => [c, zero()]),
  );

  for (const e of expenses) {
    const row = acc.get(e.category)!;
    row.gbp += e.amount_gbp ?? 0;
    row.usd += e.amount_usd ?? 0;
  }

  return CATEGORIES.map((category) => ({ category, ...acc.get(category)! }));
}

// Grand total across all categories, GBP and USD kept separate.
export function grandTotal(rows: CategoryRow[]): CurrencyPair {
  return rows.reduce(
    (acc, r) => ({ gbp: acc.gbp + r.gbp, usd: acc.usd + r.usd }),
    zero(),
  );
}

// Count of expenses missing USD (`isUsdPending`) feeding each category. A
// category's USD total is "incomplete" whenever this is nonzero.
export function usdPendingCountsByCategory(
  expenses: Expense[],
): Map<Category, number> {
  const counts = new Map<Category, number>(CATEGORIES.map((c) => [c, 0]));
  for (const e of expenses) {
    if (isUsdPending(e)) {
      counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    }
  }
  return counts;
}
