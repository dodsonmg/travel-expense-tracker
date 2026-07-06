import { describe, it, expect, beforeEach } from 'vitest';
import {
  __clearForTests,
  deleteTripStorage,
  ensureInitialized,
  loadActiveTripId,
  loadExpenses,
  loadTrips,
  saveActiveTripId,
  saveExpenses,
  saveTrips,
} from './db';
import type { Expense } from './types';

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e',
  tripId: 't',
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

describe('ensureInitialized', () => {
  it('creates one empty default trip on a fresh install', async () => {
    const { trips, activeTripId } = await ensureInitialized();
    expect(trips).toHaveLength(1);
    expect(trips[0].id).toBe(activeTripId);
    expect(trips[0].name).toBe('My Trip');
    expect(await loadExpenses(activeTripId)).toEqual([]);
  });

  it('migrates legacy flat-key data into a trip preserving its identity', async () => {
    // Simulate a pre-multi-trip user by writing directly under the old flat
    // keys, the same shape loadOrCreateTrip/loadExpenses used to read before
    // this feature.
    const legacyStore = (await import('localforage')).default.createInstance({
      name: 'travel-expense-tracker',
      storeName: 'trip',
    });
    await legacyStore.setItem('trip', {
      id: 'legacy-1',
      name: 'Old Trip',
      createdAt: '2026-01-01T00:00:00.000Z',
      budget_usd: { Transport: 200 },
    });
    await legacyStore.setItem('expenses', [
      exp({ tripId: 'legacy-1', note: 'legacy row' }),
    ]);

    const { trips, activeTripId } = await ensureInitialized();
    expect(trips).toHaveLength(1);
    expect(trips[0]).toEqual({
      id: 'legacy-1',
      name: 'Old Trip',
      createdAt: '2026-01-01T00:00:00.000Z',
      budget_usd: { Transport: 200 },
    });
    expect(activeTripId).toBe('legacy-1');

    const expenses = await loadExpenses(activeTripId);
    expect(expenses).toHaveLength(1);
    expect(expenses[0].note).toBe('legacy row');
  });

  it('is idempotent — a second call returns the same trip, does not re-migrate', async () => {
    const first = await ensureInitialized();
    const second = await ensureInitialized();
    expect(second.trips).toEqual(first.trips);
    expect(second.activeTripId).toBe(first.activeTripId);
  });

  it('falls back to the first trip when no activeTripId was ever saved', async () => {
    await saveTrips([
      { id: 'a', name: 'A', createdAt: '2026-01-01' },
      { id: 'b', name: 'B', createdAt: '2026-01-02' },
    ]);
    expect(await loadActiveTripId()).toBeNull();

    const { activeTripId } = await ensureInitialized();
    expect(activeTripId).toBe('a');
  });

  it('honors a previously saved activeTripId across multiple trips', async () => {
    await saveTrips([
      { id: 'a', name: 'A', createdAt: '2026-01-01' },
      { id: 'b', name: 'B', createdAt: '2026-01-02' },
    ]);
    await saveActiveTripId('b');

    const { activeTripId } = await ensureInitialized();
    expect(activeTripId).toBe('b');
  });
});

describe('per-trip expense scoping', () => {
  it('round-trips expenses for a given trip id', async () => {
    await saveExpenses('t1', [exp()]);
    expect(await loadExpenses('t1')).toHaveLength(1);
  });

  it('does not leak data between two different trip ids', async () => {
    await saveExpenses('t1', [exp({ note: 'trip one' })]);
    await saveExpenses('t2', [exp({ note: 'trip two' })]);

    expect((await loadExpenses('t1'))[0].note).toBe('trip one');
    expect((await loadExpenses('t2'))[0].note).toBe('trip two');
  });

  it("deleteTripStorage removes only the target trip's expenses", async () => {
    await saveExpenses('t1', [exp()]);
    await saveExpenses('t2', [exp()]);

    await deleteTripStorage('t1');

    expect(await loadExpenses('t1')).toEqual([]);
    expect(await loadExpenses('t2')).toHaveLength(1);
  });
});

describe('trip list persistence', () => {
  it('round-trips the trip list', async () => {
    const trips = [{ id: 'a', name: 'A', createdAt: '2026-01-01' }];
    await saveTrips(trips);
    expect(await loadTrips()).toEqual(trips);
  });

  it('returns null when never initialized', async () => {
    expect(await loadTrips()).toBeNull();
  });
});
