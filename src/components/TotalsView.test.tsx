import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TotalsView } from './TotalsView';
import { CATEGORIES, type Expense } from '../types';

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e',
  tripId: 't',
  date: '2026-07-01',
  category: 'Accommodation',
  amount_gbp: null,
  amount_usd: null,
  note: '',
  ...over,
});

describe('TotalsView', () => {
  it('renders all categories even with zero expenses', () => {
    render(<TotalsView expenses={[]} />);
    for (const c of CATEGORIES) {
      expect(screen.getByText(c)).toBeInTheDocument();
    }
  });

  it('shows GBP and USD separately, never combined', () => {
    render(
      <TotalsView
        expenses={[
          exp({ category: 'Transport', amount_gbp: 80, amount_usd: 100 }),
          exp({ category: 'Misc', amount_gbp: 1, amount_usd: 1 }),
        ]}
      />,
    );
    expect(screen.getByText('£80.00')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });

  it('flags a category with a USD-pending expense', () => {
    render(
      <TotalsView
        expenses={[exp({ category: 'Misc', amount_gbp: 5, amount_usd: null })]}
      />,
    );
    expect(screen.getByText('1 missing USD')).toBeInTheDocument();
  });

  it('does not flag a category once USD is filled in', () => {
    render(
      <TotalsView
        expenses={[exp({ category: 'Misc', amount_gbp: 5, amount_usd: 6 })]}
      />,
    );
    expect(screen.queryByText(/missing USD/)).toBeNull();
  });

  it('sums a grand total row across categories', () => {
    render(
      <TotalsView
        expenses={[
          exp({ category: 'Transport', amount_gbp: 10, amount_usd: 12 }),
          exp({ category: 'Misc', amount_gbp: 5, amount_usd: 6 }),
        ]}
      />,
    );
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('£15.00')).toBeInTheDocument();
    expect(screen.getByText('$18.00')).toBeInTheDocument();
  });
});
