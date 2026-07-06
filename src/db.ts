import localforage from 'localforage';
import { newId } from './lib/id';
import type { Expense, Trip } from './types';

// Single offline store, IndexedDB-backed. Nothing leaves the device except
// the CSV/xlsx the user chooses to export (SPEC.md § No backend).
const store = localforage.createInstance({
  name: 'travel-expense-tracker',
  storeName: 'trip',
  description: 'Local trip expenses',
});

// Trip-scoped data lives under `trip:<id>:<field>` keys in this same store —
// simpler than one localforage instance per trip (which would create a new
// IndexedDB object store per trip with no registry to enumerate them).
type TripField = 'expenses';
const tripKey = (tripId: string, field: TripField) => `trip:${tripId}:${field}`;

const GLOBAL_KEYS = {
  trips: 'trips',
  activeTripId: 'activeTripId',
} as const;

// Pre-multi-trip flat keys. Read only once, by ensureInitialized, to migrate
// an existing single-trip user's data into a synthetic first trip. Never
// deleted afterward (cheap safety net) and never read again once `trips`
// exists.
const LEGACY_KEYS = {
  trip: 'trip',
  expenses: 'expenses',
} as const;

export async function loadExpenses(tripId: string): Promise<Expense[]> {
  return (await store.getItem<Expense[]>(tripKey(tripId, 'expenses'))) ?? [];
}

export async function saveExpenses(
  tripId: string,
  expenses: Expense[],
): Promise<void> {
  await store.setItem(tripKey(tripId, 'expenses'), expenses);
}

export async function deleteTripStorage(tripId: string): Promise<void> {
  await store.removeItem(tripKey(tripId, 'expenses'));
}

export async function loadTrips(): Promise<Trip[] | null> {
  return store.getItem<Trip[]>(GLOBAL_KEYS.trips);
}

export async function saveTrips(trips: Trip[]): Promise<void> {
  await store.setItem(GLOBAL_KEYS.trips, trips);
}

export async function loadActiveTripId(): Promise<string | null> {
  return store.getItem<string>(GLOBAL_KEYS.activeTripId);
}

export async function saveActiveTripId(id: string): Promise<void> {
  await store.setItem(GLOBAL_KEYS.activeTripId, id);
}

// Runs once, on first load after multi-trip shipped. If `trips` already
// exists, no-ops (besides resolving the active id). Otherwise builds exactly
// one trip from whatever the legacy flat keys contain — reusing the legacy
// trip's own id/name/createdAt/budget_usd if present (an upgrading user keeps
// their trip identity), or synthesizing one for a genuinely fresh install.
export async function ensureInitialized(): Promise<{
  trips: Trip[];
  activeTripId: string;
}> {
  const existing = await loadTrips();
  if (existing && existing.length > 0) {
    const activeTripId = (await loadActiveTripId()) ?? existing[0].id;
    return { trips: existing, activeTripId };
  }

  const [legacyTrip, legacyExpenses] = await Promise.all([
    store.getItem<Trip>(LEGACY_KEYS.trip),
    store.getItem<Expense[]>(LEGACY_KEYS.expenses),
  ]);

  const trip: Trip = legacyTrip ?? {
    id: newId(),
    name: 'My Trip',
    createdAt: new Date().toISOString(),
  };

  await Promise.all([
    saveExpenses(trip.id, legacyExpenses ?? []),
    saveTrips([trip]),
    saveActiveTripId(trip.id),
  ]);

  return { trips: [trip], activeTripId: trip.id };
}

// Test-only: wipes every key in this instance's store so each test starts
// from a clean slate. Not used by app code.
export async function __clearForTests(): Promise<void> {
  await store.clear();
}
