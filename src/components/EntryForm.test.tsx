import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryForm } from './EntryForm';

describe('EntryForm', () => {
  it('cannot save until a GBP or USD amount is entered', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAdd={vi.fn()} onDone={vi.fn()} />);

    const save = screen.getByRole('button', { name: /save & add another/i });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText(/GBP/i), '80');
    expect(save).toBeEnabled();
  });

  it('submits parsed amounts and the chosen category', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<EntryForm onAdd={onAdd} onDone={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Category'), 'Food & Dining');
    await user.type(screen.getByLabelText(/USD/i), '100.50');
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Food & Dining',
        amount_gbp: null,
        amount_usd: 100.5,
        status: 'actual',
      }),
    );
  });

  it('submits status "planned" when the reserved checkbox is checked', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<EntryForm onAdd={onAdd} onDone={vi.fn()} />);

    await user.type(screen.getByLabelText(/USD/i), '650');
    await user.click(screen.getByLabelText(/reserved.*not yet paid/i));
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'planned' }),
    );
  });

  it('resets the reserved checkbox after saving', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAdd={vi.fn()} onDone={vi.fn()} />);

    await user.type(screen.getByLabelText(/USD/i), '650');
    const checkbox = screen.getByLabelText(/reserved.*not yet paid/i) as HTMLInputElement;
    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(checkbox.checked).toBe(false);
  });

  it('clears amounts and note after saving, but keeps date/category for fast repeat entry', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAdd={vi.fn()} onDone={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Category'), 'Pet Sitting');
    const gbp = screen.getByLabelText(/GBP/i) as HTMLInputElement;
    const note = screen.getByLabelText(/Note/i) as HTMLInputElement;
    await user.type(gbp, '80');
    await user.type(note, 'sitter');
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(gbp.value).toBe('');
    expect(note.value).toBe('');
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe(
      'Pet Sitting',
    );
  });

  it('"save & view list" fires onDone', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<EntryForm onAdd={vi.fn()} onDone={onDone} />);

    await user.type(screen.getByLabelText(/USD/i), '10');
    await user.click(screen.getByRole('button', { name: /save & view list/i }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('rejects a negative amount', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAdd={vi.fn()} onDone={vi.fn()} />);

    await user.type(screen.getByLabelText(/GBP/i), '-5');
    expect(screen.getByRole('button', { name: /save & add another/i })).toBeDisabled();
  });
});
