import { useCallback, useEffect, useState } from 'react';
import type { Expense } from './types';
import { loadExpenses, saveExpenses } from './db';
import { newId } from './lib/id';

// Loads one trip's expenses from IndexedDB, keeps them in React state, and
// persists any change back. `loadedFor` (rather than a boolean ready ref) is
// compared against the current tripId so that switching trips flips `ready`
// to false in the same render tripId changes — closing the window where the
// outgoing trip's still-resident state could otherwise get saved under the
// new tripId before its own load resolves.
export function useTripData(tripId: string) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const ready = loadedFor === tripId;

  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    void loadExpenses(tripId).then((e) => {
      if (!alive) return;
      setExpenses(e);
      setLoadedFor(tripId);
    });
    return () => {
      alive = false;
    };
  }, [tripId]);

  useEffect(() => {
    if (ready) void saveExpenses(tripId, expenses);
  }, [ready, tripId, expenses]);

  const addExpense = useCallback(
    (data: Omit<Expense, 'id' | 'tripId'>) => {
      setExpenses((prev) => [{ ...data, id: newId(), tripId }, ...prev]);
    },
    [tripId],
  );

  const updateExpense = useCallback((id: string, patch: Partial<Expense>) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return {
    loaded: ready,
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
  };
}

export type TripData = ReturnType<typeof useTripData>;
