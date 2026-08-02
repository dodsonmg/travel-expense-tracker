import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBackup } from './useBackup';
import {
  __clearForTests,
  loadActiveTripId,
  loadExpenses,
  loadTrips,
  saveExpenses,
  saveTrips,
} from './db';
import type { Expense, Trip } from './types';

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

beforeEach(async () => {
  await __clearForTests();
});

describe('useBackup', () => {
  it('exportBackup reflects current storage, across all trips', async () => {
    await saveTrips([trip(), trip({ id: 't2', name: 'Second' })]);
    await saveExpenses('t1', [exp()]);
    await saveExpenses('t2', [exp({ id: 'e2', tripId: 't2' })]);

    const { result } = renderHook(() => useBackup('t1'));
    const { file } = await result.current.exportBackup();

    expect(file.trips).toHaveLength(2);
    expect(file.expenses.t1).toEqual([exp()]);
    expect(file.expenses.t2).toEqual([exp({ id: 'e2', tripId: 't2' })]);
    expect(file.activeTripId).toBe('t1');
  });

  it('restoreBackup writes trips/expenses/activeTripId matching the input file', async () => {
    await saveTrips([trip({ name: 'Old data' })]);
    await saveExpenses('t1', [exp({ note: 'old' })]);

    const { result } = renderHook(() => useBackup('t1'));
    const backupTrips = [trip({ id: 'r1', name: 'Restored' })];
    const rawText = JSON.stringify({
      format: 'travel-expense-tracker-backup',
      version: 1,
      exportedAt: '2026-08-01T00:00:00.000Z',
      activeTripId: 'r1',
      trips: backupTrips,
      expenses: { r1: [exp({ id: 'r-e', tripId: 'r1', note: 'restored' })] },
    });

    await result.current.restoreBackup(rawText);

    expect(await loadTrips()).toEqual(backupTrips);
    expect(await loadExpenses('r1')).toEqual([exp({ id: 'r-e', tripId: 'r1', note: 'restored' })]);
    expect(await loadActiveTripId()).toBe('r1');
  });

  it('malformed JSON throws and writes nothing', async () => {
    await saveTrips([trip()]);
    await saveExpenses('t1', [exp()]);

    const { result } = renderHook(() => useBackup('t1'));
    await expect(result.current.restoreBackup('not json')).rejects.toThrow();

    expect(await loadTrips()).toEqual([trip()]);
    expect(await loadExpenses('t1')).toEqual([exp()]);
  });

  it('a validation failure throws and writes nothing', async () => {
    await saveTrips([trip()]);
    await saveExpenses('t1', [exp()]);

    const { result } = renderHook(() => useBackup('t1'));
    const badFile = JSON.stringify({ format: 'not-a-backup' });
    await expect(result.current.restoreBackup(badFile)).rejects.toThrow();

    expect(await loadTrips()).toEqual([trip()]);
    expect(await loadExpenses('t1')).toEqual([exp()]);
  });

  it('an activeTripId not present among the file\'s own trips falls back to the first trip', async () => {
    const { result } = renderHook(() => useBackup('t1'));
    const rawText = JSON.stringify({
      format: 'travel-expense-tracker-backup',
      version: 1,
      exportedAt: '2026-08-01T00:00:00.000Z',
      activeTripId: 'nonexistent',
      trips: [trip()],
      expenses: { t1: [] },
    });

    await result.current.restoreBackup(rawText);

    expect(await loadActiveTripId()).toBe('t1');
  });
});
