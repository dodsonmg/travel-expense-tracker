import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTripData } from './useTripData';
import type { Expense } from './types';

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

// db.ts talks to IndexedDB, which jsdom doesn't implement. Mock it so the
// hook's own state-management logic (load-once, add/update/delete, persist
// only after load) can be tested without a real IndexedDB shim.
vi.mock('./db', () => ({
  loadExpenses: () => Promise.resolve(storedExpenses),
  saveExpenses: (id: string, e: Expense[]) => saveExpenses(id, e),
}));

beforeEach(() => {
  saveExpenses.mockClear();
});

describe('useTripData', () => {
  it('starts unloaded, then reflects stored data once the load resolves', async () => {
    const { result } = renderHook(() => useTripData('trip-1'));
    expect(result.current.loaded).toBe(false);

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.expenses).toEqual(storedExpenses);
  });

  it('does not load while tripId is empty', () => {
    const { result } = renderHook(() => useTripData(''));
    expect(result.current.loaded).toBe(false);
    expect(result.current.expenses).toEqual([]);
  });

  it('addExpense assigns a generated id and the trip id, prepending to the list', async () => {
    const { result } = renderHook(() => useTripData('trip-1'));
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
    const { result } = renderHook(() => useTripData('trip-1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.updateExpense('a', { note: 'updated' });
    });

    expect(result.current.expenses[0].note).toBe('updated');
    expect(result.current.expenses[0].amount_gbp).toBe(10);
  });

  it('deleteExpense removes only the targeted row', async () => {
    const { result } = renderHook(() => useTripData('trip-1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.deleteExpense('a');
    });

    expect(result.current.expenses).toHaveLength(0);
  });

  it('does not persist until the initial load completes', async () => {
    renderHook(() => useTripData('trip-1'));
    // Synchronously after mount, the load promise hasn't resolved yet.
    expect(saveExpenses).not.toHaveBeenCalled();
  });

  it('persists expense changes after the initial load', async () => {
    const { result } = renderHook(() => useTripData('trip-1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    saveExpenses.mockClear();

    act(() => {
      result.current.deleteExpense('a');
    });

    await waitFor(() =>
      expect(saveExpenses).toHaveBeenCalledWith('trip-1', []),
    );
  });
});
