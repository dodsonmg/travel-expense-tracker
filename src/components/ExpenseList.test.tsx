import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpenseList } from './ExpenseList';
import type { Expense } from '../types';

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

describe('ExpenseList', () => {
  it('shows an empty state with no expenses', () => {
    render(<ExpenseList expenses={[]} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/no expenses yet/i)).toBeInTheDocument();
  });

  it('renders newest date first', () => {
    render(
      <ExpenseList
        expenses={[
          exp({ id: 'a', date: '2026-07-01', category: 'Transport' }),
          exp({ id: 'b', date: '2026-07-03', category: 'Misc' }),
        ]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const cats = screen.getAllByText(/Transport|Misc/).map((n) => n.textContent);
    expect(cats).toEqual(['Misc', 'Transport']);
  });

  it('"USD pending only" filter shows only pending rows', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseList
        expenses={[
          exp({ id: 'a', category: 'Accommodation', amount_gbp: 5, amount_usd: null }),
          exp({ id: 'b', category: 'Transport', amount_gbp: 5, amount_usd: 6 }),
        ]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Transport')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /usd pending only/i }));
    expect(screen.queryByText('Transport')).toBeNull();
    expect(screen.getByText('Accommodation')).toBeInTheDocument();
  });

  it('"Planned only" filter shows only planned rows, and shows a Planned badge', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseList
        expenses={[
          exp({ id: 'a', category: 'Accommodation', status: 'planned' }),
          exp({ id: 'b', category: 'Transport', status: 'actual' }),
        ]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Planned')).toHaveLength(1);
    await user.click(screen.getByRole('checkbox', { name: /planned only/i }));
    expect(screen.queryByText('Transport')).toBeNull();
    expect(screen.getByText('Accommodation')).toBeInTheDocument();
  });

  it('opens the editor when a row is clicked, and Save applies the patch', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <ExpenseList
        expenses={[exp({ id: 'a', category: 'Entertainment' })]}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('Entertainment'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    const note = screen.getByLabelText('Note') as HTMLInputElement;
    await user.type(note, 'movie night');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdate).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ note: 'movie night' }),
    );
  });

  it('editing lets you flip planned/reserved status, and Save includes it in the patch', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <ExpenseList
        expenses={[exp({ id: 'a', category: 'Entertainment', status: 'actual' })]}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('Entertainment'));
    await user.click(screen.getByLabelText(/reserved.*not yet paid/i));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdate).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ status: 'planned' }),
    );
  });

  it('Cancel discards changes and closes the editor', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseList
        expenses={[exp({ id: 'a', category: 'Misc' })]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('Misc'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByText('Misc')).toBeInTheDocument();
  });

  it('Delete removes the row', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <ExpenseList
        expenses={[exp({ id: 'a', category: 'Misc' })]}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByText('Misc'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('a');
  });
});
