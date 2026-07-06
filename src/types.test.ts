import { describe, it, expect } from 'vitest';
import { CATEGORIES, isPlanned, isUsdPending, type Expense } from './types';

const exp = (
  gbp: number | null,
  usd: number | null,
  status?: Expense['status'],
): Expense => ({
  id: 'e',
  tripId: 't',
  date: '2026-07-01',
  category: 'Accommodation',
  amount_gbp: gbp,
  amount_usd: usd,
  note: '',
  status,
});

describe('CATEGORIES', () => {
  it('is the fixed set in fixed order', () => {
    expect(CATEGORIES).toEqual([
      'Transport',
      'Accommodation',
      'Food & Dining',
      'Pet Sitting',
      'Entertainment',
      'Misc',
    ]);
  });
});

describe('isUsdPending', () => {
  it('is true when GBP is present and USD is missing', () => {
    expect(isUsdPending(exp(50, null))).toBe(true);
  });

  it('is false once USD is filled in', () => {
    expect(isUsdPending(exp(50, 62))).toBe(false);
  });

  it('is false when there is no GBP amount', () => {
    expect(isUsdPending(exp(null, 62))).toBe(false);
    expect(isUsdPending(exp(null, null))).toBe(false);
  });

  it('treats zero GBP as a real amount, not missing', () => {
    expect(isUsdPending(exp(0, null))).toBe(true);
  });
});

describe('isPlanned', () => {
  it('is false when status is undefined (pre-Phase-2 records)', () => {
    expect(isPlanned(exp(50, null))).toBe(false);
  });

  it('is false when status is actual', () => {
    expect(isPlanned(exp(50, null, 'actual'))).toBe(false);
  });

  it('is true when status is planned', () => {
    expect(isPlanned(exp(50, null, 'planned'))).toBe(true);
  });
});
