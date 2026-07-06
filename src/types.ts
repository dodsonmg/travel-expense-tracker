// Fixed category set, in fixed order (see SPEC.md § Categories).
export const CATEGORIES = [
  'Transport',
  'Accommodation',
  'Food & Dining',
  'Pet Sitting',
  'Entertainment',
  'Misc',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Currency = 'GBP' | 'USD';

// A trip groups expenses. The UI doesn't expose creating/switching trips yet
// (SPEC.md § Trip) — there is exactly one, auto-created on first load — but
// every expense already carries a tripId so multi-trip support later is
// additive rather than a migration.
export interface Trip {
  id: string;
  name: string;
  createdAt: string;
  // Per-category USD budget ceiling (SPEC.md § Data model). Lives on Trip
  // rather than a separate record so Phase 3's per-trip budgets don't need a
  // migration. A missing entry (or the whole map) means no budget set.
  budget_usd?: Partial<Record<Category, number>>;
}

export type ExpenseStatus = 'planned' | 'actual';

// A single trip expense. Amounts follow the reference app's dual-currency
// convention: GBP at time of purchase, USD once it lands on the card. No
// conversion between the two; USD is the total that matters once it's filled
// in.
export interface Expense {
  id: string;
  tripId: string;
  date: string; // ISO YYYY-MM-DD
  category: Category;
  amount_gbp: number | null;
  amount_usd: number | null;
  note: string;
  // 'planned' = known-but-unpaid commitment (e.g. a reserved hotel), entered
  // with an estimated amount. Undefined means 'actual' — pre-Phase-2 stored
  // expenses have no field at all.
  status?: ExpenseStatus;
}

// An expense with a GBP amount but no USD amount is "USD pending": the
// charge hasn't landed on the card yet.
export function isUsdPending(e: Expense): boolean {
  return e.amount_gbp != null && e.amount_usd == null;
}

// A planned/reserved expense hasn't actually been incurred yet. Reconciling
// one means editing the same row (fill in the real amount, flip status to
// 'actual') rather than creating a new expense.
export function isPlanned(e: Expense): boolean {
  return e.status === 'planned';
}
