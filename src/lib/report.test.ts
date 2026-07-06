import { describe, it, expect } from 'vitest';
import { buildReport } from './report';
import type { Expense } from '../types';

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e',
  tripId: 't',
  date: '2026-07-01',
  category: 'Accommodation',
  amount_gbp: null,
  amount_usd: null,
  note: '',
  ...over,
});

describe('buildReport', () => {
  it('maps expense fields including the usd-pending flag', () => {
    const r = buildReport([exp({ amount_gbp: 5, amount_usd: null, note: 'hotel' })]);
    expect(r.expenses[0]).toMatchObject({
      date: '2026-07-01',
      category: 'Accommodation',
      amountGbp: 5,
      amountUsd: null,
      usdPending: true,
      note: 'hotel',
    });
  });

  it('carries per-category totals and pending counts', () => {
    const r = buildReport([
      exp({ category: 'Accommodation', amount_gbp: 80, amount_usd: null }),
      exp({ category: 'Transport', amount_usd: 25 }),
    ]);
    const acc = r.categories.find((c) => c.category === 'Accommodation')!;
    const transport = r.categories.find((c) => c.category === 'Transport')!;
    expect(acc.usdPendingCount).toBe(1);
    expect(transport.usdPendingCount).toBe(0);
    expect(transport.usd).toBe(25);
  });

  it('computes a grand total across all categories', () => {
    const r = buildReport([
      exp({ category: 'Transport', amount_gbp: 10, amount_usd: 12 }),
      exp({ category: 'Misc', amount_gbp: 5, amount_usd: null }),
    ]);
    expect(r.grandTotal).toEqual({ gbp: 15, usd: 12 });
  });

  it('flags planned expenses and excludes them from category/grand totals', () => {
    const r = buildReport([
      exp({ category: 'Accommodation', amount_gbp: 500, amount_usd: 650, status: 'planned' }),
    ]);
    expect(r.expenses[0].planned).toBe(true);
    const acc = r.categories.find((c) => c.category === 'Accommodation')!;
    expect(acc.gbp).toBe(0);
    expect(acc.usd).toBe(0);
    expect(r.grandTotal).toEqual({ gbp: 0, usd: 0 });
  });

  it('carries budget-vs-actual rows and a budget grand total', () => {
    const r = buildReport(
      [
        exp({ category: 'Food & Dining', amount_usd: 100, status: 'actual' }),
        exp({ category: 'Accommodation', amount_usd: 650, status: 'planned' }),
      ],
      { 'Food & Dining': 1000, Accommodation: 1200 },
    );
    const food = r.budget.find((b) => b.category === 'Food & Dining')!;
    expect(food).toEqual({
      category: 'Food & Dining',
      budgetUsd: 1000,
      actualUsd: 100,
      plannedUsd: 0,
      remainingUsd: 900,
    });
    expect(r.budgetTotal).toEqual({
      budgetUsd: 2200,
      actualUsd: 100,
      plannedUsd: 650,
      remainingUsd: 1450,
    });
  });
});
