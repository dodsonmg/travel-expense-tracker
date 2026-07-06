import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTripData } from './useTripData';
import type { Expense, Trip } from './types';

const trip: Trip = { id: 'trip-1', name: 'My Trip', createdAt: '2026-01-01T00:00:00.000Z' };
const storedExpenses: Expense[] = [
  {
    id: 'a',
    tripId: 'trip-1',
    date: '2026-07-01',
    category: 'Transport',
    amount_gbp: 10,
    amount_usd: null,
    note: 'taxi',
  },
];

const saveExpenses = vi.fn();
const saveTrip = vi.fn();

// db.ts talks to IndexedDB, which jsdom doesn't implement. Mock it so the
// hook's own state-management logic (load-once, add/update/delete, persist
// only after load) can be tested without a real IndexedDB shim.
vi.mock('./db', () => ({
  loadOrCreateTrip: () => Promise.resolve(trip),
  loadExpenses: () => Promise.resolve(storedExpenses),
  saveExpenses: (e: Expense[]) => saveExpenses(e),
  saveTrip: (t: Trip) => saveTrip(t),
}));

beforeEach(() => {
  saveExpenses.mockClear();
  saveTrip.mockClear();
});

describe('useTripData', () => {
  it('starts unloaded, then reflects stored data once the load resolves', async () => {
    const { result } = renderHook(() => useTripData());
    expect(result.current.loaded).toBe(false);

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.trip).toEqual(trip);
    expect(result.current.expenses).toEqual(storedExpenses);
  });

  it('addExpense assigns a generated id and the trip id, prepending to the list', async () => {
    const { result } = renderHook(() => useTripData());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.addExpense({
        date: '2026-07-02',
        category: 'Misc',
        amount_gbp: null,
        amount_usd: 5,
        note: '',
      });
    });

    expect(result.current.expenses).toHaveLength(2);
    expect(result.current.expenses[0]).toMatchObject({
      tripId: 'trip-1',
      category: 'Misc',
      amount_usd: 5,
    });
    expect(result.current.expenses[0].id).toBeTruthy();
    expect(result.current.expenses[1]).toEqual(storedExpenses[0]);
  });

  it('updateExpense patches only the targeted row', async () => {
    const { result } = renderHook(() => useTripData());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.updateExpense('a', { note: 'updated' });
    });

    expect(result.current.expenses[0].note).toBe('updated');
    expect(result.current.expenses[0].amount_gbp).toBe(10);
  });

  it('deleteExpense removes only the targeted row', async () => {
    const { result } = renderHook(() => useTripData());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.deleteExpense('a');
    });

    expect(result.current.expenses).toHaveLength(0);
  });

  it('does not persist until the initial load completes', async () => {
    renderHook(() => useTripData());
    // Synchronously after mount, the load promise hasn't resolved yet.
    expect(saveExpenses).not.toHaveBeenCalled();
    expect(saveTrip).not.toHaveBeenCalled();
  });

  it('persists expense changes after the initial load', async () => {
    const { result } = renderHook(() => useTripData());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    saveExpenses.mockClear();

    act(() => {
      result.current.deleteExpense('a');
    });

    await waitFor(() => expect(saveExpenses).toHaveBeenCalledWith([]));
  });

  it('setBudget sets a category budget and persists the trip', async () => {
    const { result } = renderHook(() => useTripData());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    saveTrip.mockClear();

    act(() => {
      result.current.setBudget('Food & Dining', 1000);
    });

    expect(result.current.trip?.budget_usd).toEqual({ 'Food & Dining': 1000 });
    await waitFor(() =>
      expect(saveTrip).toHaveBeenCalledWith(
        expect.objectContaining({ budget_usd: { 'Food & Dining': 1000 } }),
      ),
    );
  });

  it('setBudget with null clears a category budget', async () => {
    const { result } = renderHook(() => useTripData());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.setBudget('Food & Dining', 1000);
    });
    act(() => {
      result.current.setBudget('Food & Dining', null);
    });

    expect(result.current.trip?.budget_usd).toEqual({});
  });
});
