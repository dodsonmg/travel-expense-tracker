import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetView } from './BudgetView';
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

describe('BudgetView', () => {
  it('renders all categories in fixed order, even with no budgets set', () => {
    render(<BudgetView expenses={[]} budget={{}} onSetBudget={vi.fn()} />);
    for (const c of CATEGORIES) {
      expect(screen.getByText(c)).toBeInTheDocument();
    }
  });

  it('shows actual and planned spend in separate columns', () => {
    render(
      <BudgetView
        expenses={[
          exp({ category: 'Food & Dining', amount_usd: 100, status: 'actual' }),
          exp({ category: 'Accommodation', amount_usd: 650, status: 'planned' }),
        ]}
        budget={{ 'Food & Dining': 1000, Accommodation: 1200 }}
        onSetBudget={vi.fn()}
      />,
    );
    // Food & Dining actual (also matches the grand total's Actual column).
    expect(screen.getAllByText('$100.00')).toHaveLength(2);
    // Accommodation planned (also matches the grand total's Planned column).
    expect(screen.getAllByText('$650.00')).toHaveLength(2);
  });

  it('editing a budget input calls onSetBudget with the parsed amount', async () => {
    const user = userEvent.setup();
    const onSetBudget = vi.fn();
    render(<BudgetView expenses={[]} budget={{}} onSetBudget={onSetBudget} />);

    const input = screen.getByLabelText('Food & Dining budget');
    await user.type(input, '1000');

    expect(onSetBudget).toHaveBeenLastCalledWith('Food & Dining', 1000);
  });

  it('flags an over-budget category', () => {
    render(
      <BudgetView
        expenses={[exp({ category: 'Misc', amount_usd: 150, status: 'actual' })]}
        budget={{ Misc: 100 }}
        onSetBudget={vi.fn()}
      />,
    );
    expect(screen.getByText('over budget')).toBeInTheDocument();
  });

  it('does not flag a category within budget', () => {
    render(
      <BudgetView
        expenses={[exp({ category: 'Misc', amount_usd: 50, status: 'actual' })]}
        budget={{ Misc: 100 }}
        onSetBudget={vi.fn()}
      />,
    );
    expect(screen.queryByText('over budget')).toBeNull();
  });

  it('shows a grand total row', () => {
    render(
      <BudgetView
        expenses={[
          exp({ category: 'Food & Dining', amount_usd: 100, status: 'actual' }),
          exp({ category: 'Accommodation', amount_usd: 650, status: 'planned' }),
        ]}
        budget={{ 'Food & Dining': 1000, Accommodation: 1200 }}
        onSetBudget={vi.fn()}
      />,
    );
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$2,200.00')).toBeInTheDocument(); // budget total
    expect(screen.getByText('$1,450.00')).toBeInTheDocument(); // remaining total
  });
});
