import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFilename,
  buildBackupFile,
  validateBackupFile,
} from './backup';
import type { Expense, Trip } from '../types';

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: 'My Trip',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e',
  tripId: 't1',
  date: '2026-07-01',
  category: 'Accommodation',
  amount_gbp: null,
  amount_usd: 10,
  note: '',
  ...over,
});

describe('buildBackupFile', () => {
  it('builds a full round-trippable snapshot', () => {
    const file = buildBackupFile([trip()], { t1: [exp()] }, 't1');
    expect(file.format).toBe(BACKUP_FORMAT);
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.activeTripId).toBe('t1');
    expect(file.trips).toEqual([trip()]);
    expect(file.expenses).toEqual({ t1: [exp()] });
    expect(file.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('validateBackupFile', () => {
  it('accepts a well-formed backup file', () => {
    const file = buildBackupFile([trip()], { t1: [exp()] }, 't1');
    expect(validateBackupFile(JSON.parse(JSON.stringify(file)))).toEqual(file);
  });

  it('is lenient about a trip missing an expenses entry, defaulting to []', () => {
    const file = buildBackupFile([trip(), trip({ id: 't2', name: 'Second' })], { t1: [exp()] }, 't1');
    const result = validateBackupFile(JSON.parse(JSON.stringify(file)));
    expect(result.expenses.t2).toEqual([]);
  });

  it('falls back activeTripId to the first trip when missing/invalid', () => {
    const file = buildBackupFile([trip()], { t1: [] }, 'not-a-real-id');
    expect(validateBackupFile(file).activeTripId).toBe('t1');
  });

  it.each([null, 42, 'a string', []])('rejects non-object input: %p', (raw) => {
    expect(() => validateBackupFile(raw)).toThrow(/doesn't look like/i);
  });

  it('rejects the wrong format', () => {
    expect(() => validateBackupFile({ format: 'something-else' })).toThrow(/doesn't look like/i);
  });

  it('rejects a version newer than supported', () => {
    expect(() =>
      validateBackupFile({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, trips: [trip()] }),
    ).toThrow(/newer version/i);
  });

  it('rejects an empty or non-array trips list', () => {
    expect(() =>
      validateBackupFile({ format: BACKUP_FORMAT, version: 1, trips: [] }),
    ).toThrow(/no trips/i);
    expect(() =>
      validateBackupFile({ format: BACKUP_FORMAT, version: 1, trips: 'nope' }),
    ).toThrow(/no trips/i);
  });

  it('rejects a trip missing required fields', () => {
    expect(() =>
      validateBackupFile({
        format: BACKUP_FORMAT,
        version: 1,
        trips: [{ id: 't1' }],
      }),
    ).toThrow(/missing required fields/i);
  });
});

describe('backupFilename', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('embeds today\'s date, no trip-name slug', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00.000Z'));
    expect(backupFilename()).toBe('travel-expense-tracker-backup-2026-08-02.json');
  });
});
