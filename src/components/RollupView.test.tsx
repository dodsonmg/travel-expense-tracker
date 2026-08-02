import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RollupView } from './RollupView';
import type { Expense, Trip } from '../types';

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

const trips: Trip[] = [
  { id: 'a', name: 'London Aug 2026', createdAt: '2026-08-01', budget_usd: { Transport: 500 } },
  { id: 'b', name: 'Bali Sep 2026', createdAt: '2026-09-01', budget_usd: { Misc: 300 } },
];

describe('RollupView', () => {
  it('shows a loading state', () => {
    render(<RollupView trips={trips} expensesByTripId={{}} loaded={false} onSelectTrip={vi.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders one tile per non-archived trip, in fixed registry order', () => {
    render(
      <RollupView
        trips={trips}
        expensesByTripId={{
          a: [exp({ tripId: 'a', category: 'Transport', amount_usd: 100, status: 'actual' })],
          b: [exp({ tripId: 'b', category: 'Misc', amount_usd: 50, status: 'planned' })],
        }}
        loaded
        onSelectTrip={vi.fn()}
      />,
    );
    expect(screen.getByText('London Aug 2026')).toBeInTheDocument();
    expect(screen.getByText('Bali Sep 2026')).toBeInTheDocument();
  });

  it('excludes archived trips', () => {
    const withArchived = [...trips, { id: 'c', name: 'Old trip', createdAt: '2025-01-01', archived: true }];
    render(
      <RollupView trips={withArchived} expensesByTripId={{}} loaded onSelectTrip={vi.fn()} />,
    );
    expect(screen.queryByText('Old trip')).not.toBeInTheDocument();
  });

  it('a grand-total tile sums across trips', () => {
    render(
      <RollupView
        trips={trips}
        expensesByTripId={{
          a: [exp({ tripId: 'a', category: 'Transport', amount_usd: 100, status: 'actual' })],
          b: [exp({ tripId: 'b', category: 'Misc', amount_usd: 50, status: 'actual' })],
        }}
        loaded
        onSelectTrip={vi.fn()}
      />,
    );
    expect(screen.getByText('All trips')).toBeInTheDocument();
    expect(screen.getByText('$800.00')).toBeInTheDocument(); // 500 + 300 budget
  });

  it('shows the empty state when all trips are archived', () => {
    const allArchived = trips.map((t) => ({ ...t, archived: true }));
    render(<RollupView trips={allArchived} expensesByTripId={{}} loaded onSelectTrip={vi.fn()} />);
    expect(screen.getByText(/all trips are archived/i)).toBeInTheDocument();
  });

  it('tapping a trip tile calls onSelectTrip with its id', async () => {
    const user = userEvent.setup();
    const onSelectTrip = vi.fn();
    render(
      <RollupView trips={trips} expensesByTripId={{}} loaded onSelectTrip={onSelectTrip} />,
    );
    await user.click(screen.getByText('London Aug 2026'));
    expect(onSelectTrip).toHaveBeenCalledWith('a');
  });
});
