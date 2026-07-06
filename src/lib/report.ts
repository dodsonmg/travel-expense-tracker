import { isPlanned, isUsdPending, type Category, type Expense } from '../types';
import {
  grandTotal,
  totalsByCategory,
  usdPendingCountsByCategory,
  type CurrencyPair,
} from './totals';
import { budgetByCategory, budgetGrandTotal, type BudgetTotal } from './budget';

// A single structured model of an export, so the CSV and XLSX exporters
// render from the same numbers and never drift.

export interface ReportExpenseRow {
  date: string;
  category: Category;
  amountGbp: number | null;
  amountUsd: number | null;
  usdPending: boolean;
  planned: boolean;
  note: string;
}

export interface ReportCategoryRow {
  category: Category;
  gbp: number;
  usd: number;
  usdPendingCount: number; // # expenses missing USD feeding this row; >0 = pending
}

export interface ReportBudgetRow {
  category: Category;
  budgetUsd: number;
  actualUsd: number;
  plannedUsd: number;
  remainingUsd: number;
}

export interface Report {
  expenses: ReportExpenseRow[];
  categories: ReportCategoryRow[];
  grandTotal: CurrencyPair;
  budget: ReportBudgetRow[];
  budgetTotal: BudgetTotal;
}

export function buildReport(
  expenses: Expense[],
  budget: Partial<Record<Category, number>> = {},
): Report {
  const byCategory = totalsByCategory(expenses);
  const pending = usdPendingCountsByCategory(expenses);
  const byBudget = budgetByCategory(expenses, budget);

  return {
    expenses: expenses.map((e) => ({
      date: e.date,
      category: e.category,
      amountGbp: e.amount_gbp,
      amountUsd: e.amount_usd,
      usdPending: isUsdPending(e),
      planned: isPlanned(e),
      note: e.note,
    })),
    categories: byCategory.map((r) => ({
      category: r.category,
      gbp: r.gbp,
      usd: r.usd,
      usdPendingCount: pending.get(r.category) ?? 0,
    })),
    grandTotal: grandTotal(byCategory),
    budget: byBudget,
    budgetTotal: budgetGrandTotal(byBudget),
  };
}
