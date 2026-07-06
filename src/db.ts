import localforage from 'localforage';
import type { Expense, Trip } from './types';

// Single offline store, IndexedDB-backed. Nothing leaves the device except
// the CSV/xlsx the user chooses to export (SPEC.md § No backend).
const store = localforage.createInstance({
  name: 'travel-expense-tracker',
  storeName: 'trip',
  description: 'Local trip expenses',
});

const KEYS = {
  trip: 'trip',
  expenses: 'expenses',
} as const;

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Loads the hidden default trip, creating it once on first run. Not exposed
// in the UI yet (SPEC.md § Trip) — every expense is stamped with this id so
// multi-trip support later doesn't need a data migration.
export async function loadOrCreateTrip(): Promise<Trip> {
  const existing = await store.getItem<Trip>(KEYS.trip);
  if (existing) return existing;
  const trip: Trip = {
    id: newId(),
    name: 'My Trip',
    createdAt: new Date().toISOString(),
  };
  await store.setItem(KEYS.trip, trip);
  return trip;
}

export async function loadExpenses(): Promise<Expense[]> {
  return (await store.getItem<Expense[]>(KEYS.expenses)) ?? [];
}

export async function saveExpenses(expenses: Expense[]): Promise<void> {
  await store.setItem(KEYS.expenses, expenses);
}
