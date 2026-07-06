import { describe, it, expect, vi, afterEach } from 'vitest';
import { money, today, slugify } from './format';

describe('money', () => {
  it('renders a placeholder for null', () => {
    expect(money(null, 'GBP')).toBe('—');
    expect(money(null, 'USD')).toBe('—');
  });

  it('formats GBP and USD with the correct currency symbol', () => {
    expect(money(12.5, 'GBP')).toBe('£12.50');
    expect(money(12.5, 'USD')).toBe('$12.50');
  });

  it('formats zero as a real amount, not a placeholder', () => {
    expect(money(0, 'USD')).toBe('$0.00');
  });
});

describe('today', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns YYYY-MM-DD for the local date', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not roll to the next/previous day across a UTC offset', () => {
    // 11:30pm local in a timezone 5 hours behind UTC is 4:30am UTC the next
    // day; today() must still report the *local* date, not the UTC one.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T23:30:00-05:00'));
    const originalOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = () => 300; // UTC-5, in minutes
    try {
      expect(today()).toBe('2026-03-04');
    } finally {
      Date.prototype.getTimezoneOffset = originalOffset;
    }
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates spaces/punctuation', () => {
    expect(slugify('London Aug 2026')).toBe('london-aug-2026');
  });

  it('trims leading/trailing hyphens produced by leading/trailing punctuation', () => {
    expect(slugify('  --Bali!! 2027--  ')).toBe('bali-2027');
  });

  it('falls back to "trip" for empty or all-punctuation input', () => {
    expect(slugify('')).toBe('trip');
    expect(slugify('   ')).toBe('trip');
    expect(slugify('!!!')).toBe('trip');
  });
});
