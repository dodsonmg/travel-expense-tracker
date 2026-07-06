import { describe, it, expect } from 'vitest';
import { budgetByCategory, budgetGrandTotal } from './budget';
import { CATEGORIES, type Expense } from '../types';

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

describe('budgetByCategory', () => {
  it('returns rows in the fixed category order, even with no expenses or budget', () => {
    const rows = budgetByCategory([], {});
    expect(rows.map((r) => r.category)).toEqual([...CATEGORIES]);
    expect(
      rows.every(
        (r) =>
          r.budgetUsd === 0 &&
          r.actualUsd === 0 &&
          r.plannedUsd === 0 &&
          r.remainingUsd === 0,
      ),
    ).toBe(true);
  });

  it('separates actual spend from planned/reserved spend', () => {
    const rows = budgetByCategory(
      [
        exp({ category: 'Food & Dining', amount_usd: 100, status: 'actual' }),
        exp({ category: 'Food & Dining', amount_usd: 50 }), // undefined status = actual
        exp({ category: 'Accommodation', amount_usd: 650, status: 'planned' }),
      ],
      { 'Food & Dining': 1000, Accommodation: 1200 },
    );

    const food = rows.find((r) => r.category === 'Food & Dining')!;
    expect(food.budgetUsd).toBe(1000);
    expect(food.actualUsd).toBe(150);
    expect(food.plannedUsd).toBe(0);
    expect(food.remainingUsd).toBe(850);

    const stay = rows.find((r) => r.category === 'Accommodation')!;
    expect(stay.budgetUsd).toBe(1200);
    expect(stay.actualUsd).toBe(0);
    expect(stay.plannedUsd).toBe(650);
    expect(stay.remainingUsd).toBe(550);
  });

  it('does not fall back to GBP when USD is missing, for either status', () => {
    const rows = budgetByCategory(
      [
        exp({ category: 'Transport', amount_gbp: 40, amount_usd: null, status: 'actual' }),
        exp({ category: 'Transport', amount_gbp: 60, amount_usd: null, status: 'planned' }),
      ],
      { Transport: 100 },
    );
    const transport = rows.find((r) => r.category === 'Transport')!;
    expect(transport.actualUsd).toBe(0);
    expect(transport.plannedUsd).toBe(0);
    expect(transport.remainingUsd).toBe(100);
  });

  it('a category with no budget set shows $0 and goes negative once spent', () => {
    const rows = budgetByCategory(
      [exp({ category: 'Misc', amount_usd: 35, status: 'actual' })],
      {},
    );
    const misc = rows.find((r) => r.category === 'Misc')!;
    expect(misc.budgetUsd).toBe(0);
    expect(misc.remainingUsd).toBe(-35);
  });
});

describe('budgetGrandTotal', () => {
  it('sums budget/actual/planned/remaining across all categories', () => {
    const rows = budgetByCategory(
      [
        exp({ category: 'Food & Dining', amount_usd: 100, status: 'actual' }),
        exp({ category: 'Accommodation', amount_usd: 650, status: 'planned' }),
      ],
      { 'Food & Dining': 1000, Accommodation: 1200 },
    );
    expect(budgetGrandTotal(rows)).toEqual({
      budgetUsd: 2200,
      actualUsd: 100,
      plannedUsd: 650,
      remainingUsd: 1450,
    });
  });
});
