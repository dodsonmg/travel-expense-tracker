import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportView } from './ExportView';
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

const trips: Trip[] = [{ id: 't', name: 'My Trip', createdAt: '2026-01-01' }];

describe('ExportView', () => {
  it('offers .xlsx (primary) and CSV exports', () => {
    render(
      <ExportView
        expenses={[exp()]}
        budget={{}}
        tripName="My Trip"
        trips={trips}
        activeTripId="t"
        lastBackup={null}
        onBackedUp={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /export & share \.xlsx/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /download \.xlsx/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /download csv/i })).toBeEnabled();
  });

  it('disables export when there is nothing to export', () => {
    render(
      <ExportView
        expenses={[]}
        budget={{}}
        tripName="My Trip"
        trips={trips}
        activeTripId="t"
        lastBackup={null}
        onBackedUp={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /export & share \.xlsx/i })).toBeDisabled();
    expect(screen.getByText(/nothing to export yet/i)).toBeInTheDocument();
  });

  it('renders the backup panel', () => {
    render(
      <ExportView
        expenses={[exp()]}
        budget={{}}
        tripName="My Trip"
        trips={trips}
        activeTripId="t"
        lastBackup={null}
        onBackedUp={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /download backup/i })).toBeInTheDocument();
    expect(screen.getByText(/last backup: never/i)).toBeInTheDocument();
  });
});
