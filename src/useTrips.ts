import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category, Trip } from './types';
import {
  deleteTripStorage,
  ensureInitialized,
  saveActiveTripId,
  saveTrips,
} from './db';
import { newId } from './lib/id';

// Owns the trip list and which one is active — separate from useTripData,
// which owns one trip's expenses. A device always has at least one trip;
// ensureInitialized (db.ts) guarantees that on first load, migrating any
// pre-multi-trip data into a trip that keeps its original identity.
export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripIdState] = useState('');
  const [loaded, setLoaded] = useState(false);
  const ready = useRef(false);

  useEffect(() => {
    void ensureInitialized().then(({ trips, activeTripId }) => {
      setTrips(trips);
      setActiveTripIdState(activeTripId);
      ready.current = true;
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (ready.current) void saveTrips(trips);
  }, [trips]);

  useEffect(() => {
    if (ready.current) void saveActiveTripId(activeTripId);
  }, [activeTripId]);

  const selectTrip = useCallback((id: string) => {
    setActiveTripIdState(id);
  }, []);

  const createTrip = useCallback((name: string) => {
    const trip: Trip = {
      id: newId(),
      name: name.trim() || 'New trip',
      createdAt: new Date().toISOString(),
    };
    setTrips((prev) => [...prev, trip]);
    setActiveTripIdState(trip.id);
    return trip.id;
  }, []);

  const renameTrip = useCallback((id: string, name: string) => {
    setTrips((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: name.trim() || t.name } : t)),
    );
  }, []);

  // No-ops if this is the last remaining trip — a device always has >=1.
  const deleteTrip = useCallback((id: string) => {
    setTrips((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((t) => t.id !== id);
      void deleteTripStorage(id);
      setActiveTripIdState((cur) => (cur === id ? next[0].id : cur));
      return next;
    });
  }, []);

  const setBudget = useCallback(
    (tripId: string, category: Category, amount: number | null) => {
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== tripId) return t;
          const next = { ...(t.budget_usd ?? {}) };
          if (amount == null) delete next[category];
          else next[category] = amount;
          return { ...t, budget_usd: next };
        }),
      );
    },
    [],
  );

  return {
    loaded,
    trips,
    activeTripId,
    selectTrip,
    createTrip,
    renameTrip,
    deleteTrip,
    setBudget,
  };
}

export type Trips = ReturnType<typeof useTrips>;
