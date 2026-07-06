import { describe, it, expect } from 'vitest';
import {
  grandTotal,
  totalsByCategory,
  usdPendingCountsByCategory,
} from './totals';
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

describe('totalsByCategory', () => {
  it('returns rows in the fixed category order, even with no expenses', () => {
    const rows = totalsByCategory([]);
    expect(rows.map((r) => r.category)).toEqual([...CATEGORIES]);
    expect(rows.every((r) => r.gbp === 0 && r.usd === 0)).toBe(true);
  });

  it('keeps GBP and USD separate (never summed)', () => {
    const rows = totalsByCategory([
      exp({ category: 'Accommodation', amount_gbp: 80, amount_usd: 100 }),
    ]);
    const acc = rows.find((r) => r.category === 'Accommodation')!;
    expect(acc.gbp).toBe(80);
    expect(acc.usd).toBe(100);
  });

  it('sums multiple expenses in the same category', () => {
    const rows = totalsByCategory([
      exp({ category: 'Transport', amount_gbp: 10, amount_usd: 12 }),
      exp({ category: 'Transport', amount_gbp: 5, amount_usd: 6 }),
    ]);
    const transport = rows.find((r) => r.category === 'Transport')!;
    expect(transport.gbp).toBe(15);
    expect(transport.usd).toBe(18);
  });

  it('treats missing amounts as zero', () => {
    const rows = totalsByCategory([
      exp({ category: 'Transport', amount_gbp: 10, amount_usd: null }),
      exp({ category: 'Transport', amount_gbp: null, amount_usd: 25 }),
    ]);
    const t = rows.find((r) => r.category === 'Transport')!;
    expect(t.gbp).toBe(10);
    expect(t.usd).toBe(25);
  });
});

describe('grandTotal', () => {
  it('sums across all categories, GBP and USD kept separate', () => {
    const rows = totalsByCategory([
      exp({ category: 'Transport', amount_gbp: 10, amount_usd: 12 }),
      exp({ category: 'Misc', amount_gbp: 5, amount_usd: null }),
    ]);
    expect(grandTotal(rows)).toEqual({ gbp: 15, usd: 12 });
  });
});

describe('usdPendingCountsByCategory', () => {
  it('counts USD-pending expenses per category, zero elsewhere', () => {
    const counts = usdPendingCountsByCategory([
      exp({ category: 'Accommodation', amount_gbp: 80, amount_usd: null }),
      exp({ category: 'Accommodation', amount_gbp: 20, amount_usd: null }),
      exp({ category: 'Transport', amount_gbp: 10, amount_usd: 12 }), // not pending
    ]);
    expect(counts.get('Accommodation')).toBe(2);
    expect(counts.get('Transport')).toBe(0);
    expect(counts.get('Misc')).toBe(0);
  });
});
