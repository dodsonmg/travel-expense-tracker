import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category, Expense, Trip } from './types';
import { loadExpenses, loadOrCreateTrip, saveExpenses, saveTrip } from './db';

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Loads the trip from IndexedDB once, keeps it in React state, and persists
// any change back. Persistence is skipped until the initial load completes so
// we never overwrite stored data with the empty initial state.
export function useTripData() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ready = useRef(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([loadOrCreateTrip(), loadExpenses()]).then(([t, e]) => {
      if (!alive) return;
      setTrip(t);
      setExpenses(e);
      ready.current = true;
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (ready.current) void saveExpenses(expenses);
  }, [expenses]);

  useEffect(() => {
    if (ready.current && trip) void saveTrip(trip);
  }, [trip]);

  const addExpense = useCallback(
    (data: Omit<Expense, 'id' | 'tripId'>) => {
      setExpenses((prev) => [
        { ...data, id: newId(), tripId: trip?.id ?? '' },
        ...prev,
      ]);
    },
    [trip],
  );

  const updateExpense = useCallback((id: string, patch: Partial<Expense>) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const setBudget = useCallback((category: Category, amount: number | null) => {
    setTrip((t) => {
      if (!t) return t;
      const next = { ...(t.budget_usd ?? {}) };
      if (amount == null) delete next[category];
      else next[category] = amount;
      return { ...t, budget_usd: next };
    });
  }, []);

  return {
    loaded,
    trip,
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    setBudget,
  };
}

export type TripData = ReturnType<typeof useTripData>;
