import { isUsdPending, type Category, type Expense } from '../types';
import {
  grandTotal,
  totalsByCategory,
  usdPendingCountsByCategory,
  type CurrencyPair,
} from './totals';

// A single structured model of an export, so the CSV and XLSX exporters
// render from the same numbers and never drift.

export interface ReportExpenseRow {
  date: string;
  category: Category;
  amountGbp: number | null;
  amountUsd: number | null;
  usdPending: boolean;
  note: string;
}

export interface ReportCategoryRow {
  category: Category;
  gbp: number;
  usd: number;
  usdPendingCount: number; // # expenses missing USD feeding this row; >0 = pending
}

export interface Report {
  expenses: ReportExpenseRow[];
  categories: ReportCategoryRow[];
  grandTotal: CurrencyPair;
}

export function buildReport(expenses: Expense[]): Report {
  const byCategory = totalsByCategory(expenses);
  const pending = usdPendingCountsByCategory(expenses);

  return {
    expenses: expenses.map((e) => ({
      date: e.date,
      category: e.category,
      amountGbp: e.amount_gbp,
      amountUsd: e.amount_usd,
      usdPending: isUsdPending(e),
      note: e.note,
    })),
    categories: byCategory.map((r) => ({
      category: r.category,
      gbp: r.gbp,
      usd: r.usd,
      usdPendingCount: pending.get(r.category) ?? 0,
    })),
    grandTotal: grandTotal(byCategory),
  };
}
