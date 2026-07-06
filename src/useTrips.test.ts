import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTrips } from './useTrips';
import { __clearForTests } from './db';

beforeEach(async () => {
  await __clearForTests();
});

describe('useTrips', () => {
  it('auto-creates one trip on first load', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.trips).toHaveLength(1);
    expect(result.current.activeTripId).toBe(result.current.trips[0].id);
  });

  it('creates a trip and switches to it', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    let newTripId = '';
    act(() => {
      newTripId = result.current.createTrip('Bali 2027');
    });

    await waitFor(() => expect(result.current.trips).toHaveLength(2));
    expect(result.current.activeTripId).toBe(newTripId);
    expect(result.current.trips.find((t) => t.id === newTripId)?.name).toBe(
      'Bali 2027',
    );
  });

  it('renames a trip', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const id = result.current.trips[0].id;

    act(() => result.current.renameTrip(id, 'Tokyo Spring'));

    await waitFor(() =>
      expect(result.current.trips.find((t) => t.id === id)?.name).toBe(
        'Tokyo Spring',
      ),
    );
  });

  it('a blank rename leaves the existing name untouched', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const id = result.current.trips[0].id;
    const originalName = result.current.trips[0].name;

    act(() => result.current.renameTrip(id, '   '));

    expect(result.current.trips.find((t) => t.id === id)?.name).toBe(
      originalName,
    );
  });

  it('refuses to delete the last remaining trip', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const id = result.current.trips[0].id;

    act(() => result.current.deleteTrip(id));

    expect(result.current.trips).toHaveLength(1);
    expect(result.current.trips[0].id).toBe(id);
  });

  it('deleting the active trip reassigns activeTripId to a remaining trip', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const firstId = result.current.trips[0].id;

    let secondId = '';
    act(() => {
      secondId = result.current.createTrip('Second trip');
    });
    await waitFor(() => expect(result.current.trips).toHaveLength(2));
    expect(result.current.activeTripId).toBe(secondId);

    act(() => result.current.deleteTrip(secondId));

    await waitFor(() => expect(result.current.trips).toHaveLength(1));
    expect(result.current.activeTripId).toBe(firstId);
  });

  it('deleting a non-active trip leaves activeTripId untouched', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const firstId = result.current.trips[0].id;

    let secondId = '';
    act(() => {
      secondId = result.current.createTrip('Second trip');
    });
    await waitFor(() => expect(result.current.trips).toHaveLength(2));
    // creating switches active to the new trip; switch back to the first
    act(() => result.current.selectTrip(firstId));

    act(() => result.current.deleteTrip(secondId));

    await waitFor(() => expect(result.current.trips).toHaveLength(1));
    expect(result.current.activeTripId).toBe(firstId);
  });

  it('setBudget patches only the targeted trip', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const firstId = result.current.trips[0].id;

    let secondId = '';
    act(() => {
      secondId = result.current.createTrip('Second trip');
    });
    await waitFor(() => expect(result.current.trips).toHaveLength(2));

    act(() => result.current.setBudget(firstId, 'Food & Dining', 500));

    expect(
      result.current.trips.find((t) => t.id === firstId)?.budget_usd,
    ).toEqual({ 'Food & Dining': 500 });
    expect(
      result.current.trips.find((t) => t.id === secondId)?.budget_usd,
    ).toBeUndefined();
  });

  it('setBudget with null clears a category budget', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const id = result.current.trips[0].id;

    act(() => result.current.setBudget(id, 'Food & Dining', 500));
    act(() => result.current.setBudget(id, 'Food & Dining', null));

    expect(result.current.trips.find((t) => t.id === id)?.budget_usd).toEqual(
      {},
    );
  });
});
