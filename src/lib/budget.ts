import { CATEGORIES, isPlanned, type Category, type Expense } from '../types';

// Budget vs. actual vs. planned, by category, in the fixed category order.
// USD-only: an expense with no amount_usd contributes $0 here, whether it's
// planned or actual — no GBP fallback, keeping the "never mix currencies"
// rule intact (SPEC.md § Budget).
export interface BudgetRow {
  category: Category;
  budgetUsd: number;
  actualUsd: number;
  plannedUsd: number;
  remainingUsd: number; // budgetUsd - actualUsd - plannedUsd
}

export function budgetByCategory(
  expenses: Expense[],
  budget: Partial<Record<Category, number>>,
): BudgetRow[] {
  const acc = new Map<Category, { actual: number; planned: number }>(
    CATEGORIES.map((c) => [c, { actual: 0, planned: 0 }]),
  );

  for (const e of expenses) {
    if (e.amount_usd == null) continue;
    const row = acc.get(e.category)!;
    if (isPlanned(e)) row.planned += e.amount_usd;
    else row.actual += e.amount_usd;
  }

  return CATEGORIES.map((category) => {
    const budgetUsd = budget[category] ?? 0;
    const { actual, planned } = acc.get(category)!;
    return {
      category,
      budgetUsd,
      actualUsd: actual,
      plannedUsd: planned,
      remainingUsd: budgetUsd - actual - planned,
    };
  });
}

export interface BudgetTotal {
  budgetUsd: number;
  actualUsd: number;
  plannedUsd: number;
  remainingUsd: number;
}

export function budgetGrandTotal(rows: BudgetRow[]): BudgetTotal {
  return rows.reduce(
    (acc, r) => ({
      budgetUsd: acc.budgetUsd + r.budgetUsd,
      actualUsd: acc.actualUsd + r.actualUsd,
      plannedUsd: acc.plannedUsd + r.plannedUsd,
      remainingUsd: acc.remainingUsd + r.remainingUsd,
    }),
    { budgetUsd: 0, actualUsd: 0, plannedUsd: 0, remainingUsd: 0 },
  );
}
