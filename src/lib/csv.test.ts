import { describe, it, expect } from 'vitest';
import { buildCsv, csvFilename } from './csv';
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

describe('buildCsv', () => {
  it('emits the two sections in order', () => {
    const csv = buildCsv([]);
    const iExp = csv.indexOf('EXPENSES');
    const iCat = csv.indexOf('TOTALS BY CATEGORY');
    expect(iExp).toBeGreaterThanOrEqual(0);
    expect(iExp).toBeLessThan(iCat);
  });

  it('writes money as plain 2-dp numbers, blank when absent', () => {
    const csv = buildCsv([exp({ amount_gbp: 80, amount_usd: null })]);
    const line = csv.split('\r\n').find((l) => l.startsWith('2026-07-01'))!;
    // date,category,amount_gbp,amount_usd,usd_pending,note
    expect(line).toBe('2026-07-01,Accommodation,80.00,,yes,');
  });

  it('flags USD-pending rows (GBP present, USD absent)', () => {
    const csv = buildCsv([exp({ amount_gbp: 5, amount_usd: null })]);
    expect(csv).toMatch(/,yes,/);
  });

  it('does not flag rows once USD is filled in', () => {
    const csv = buildCsv([exp({ amount_gbp: 5, amount_usd: 6 })]);
    const line = csv.split('\r\n').find((l) => l.startsWith('2026-07-01'))!;
    expect(line).toBe('2026-07-01,Accommodation,5.00,6.00,,');
  });

  it('escapes commas and quotes in notes', () => {
    const csv = buildCsv([exp({ amount_usd: 1, note: 'taxi, "receipt" #4' })]);
    expect(csv).toContain('"taxi, ""receipt"" #4"');
  });

  it('includes a totals-by-category block and a grand total row', () => {
    const csv = buildCsv([
      exp({ category: 'Transport', amount_gbp: 10, amount_usd: 12 }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines).toContain('category,gbp,usd,usd_pending_count');
    expect(lines).toContain('Transport,10.00,12.00,');
    expect(lines).toContain('TOTAL,10.00,12.00,');
  });
});

describe('csvFilename', () => {
  it('is dated YYYY-MM-DD', () => {
    expect(csvFilename(new Date('2026-07-04T12:00:00Z'))).toBe(
      'trip-expenses-2026-07-04.csv',
    );
  });
});
