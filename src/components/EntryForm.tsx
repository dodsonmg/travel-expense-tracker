import { useState } from 'react';
import { CATEGORIES, type Category, type Expense } from '../types';
import { parseAmount, today } from '../lib/format';

interface Props {
  onAdd: (data: Omit<Expense, 'id' | 'tripId'>) => void;
  onDone: () => void;
}

// Optimized for fast repeated entry: after saving, amounts and note clear but
// date/category persist for the next row.
export function EntryForm({ onAdd, onDone }: Props) {
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<Category>('Transport');
  const [gbp, setGbp] = useState('');
  const [usd, setUsd] = useState('');
  const [note, setNote] = useState('');
  const [planned, setPlanned] = useState(false);

  const amountGbp = parseAmount(gbp);
  const amountUsd = parseAmount(usd);
  const canSave = amountGbp != null || amountUsd != null;

  function save(thenDone: boolean) {
    if (!canSave) return;
    onAdd({
      date,
      category,
      amount_gbp: amountGbp,
      amount_usd: amountUsd,
      note: note.trim(),
      status: planned ? 'planned' : 'actual',
    });
    setGbp('');
    setUsd('');
    setNote('');
    setPlanned(false);
    if (thenDone) onDone();
  }

  return (
    <form
      className="card form"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      <label className="field">
        <span>Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <div className="field-row">
        <label className="field">
          <span>GBP (receipt)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={gbp}
            onChange={(e) => setGbp(e.target.value)}
          />
        </label>
        <label className="field">
          <span>USD (card)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="pending"
            value={usd}
            onChange={(e) => setUsd(e.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span>Note (vendor / description)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="optional"
        />
      </label>

      <label className="filter">
        <input
          type="checkbox"
          checked={planned}
          onChange={(e) => setPlanned(e.target.checked)}
        />
        <span>Reserved / not yet paid (planned)</span>
      </label>

      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={!canSave}>
          Save &amp; add another
        </button>
        <button
          type="button"
          className="btn"
          disabled={!canSave}
          onClick={() => save(true)}
        >
          Save &amp; view list
        </button>
      </div>
      {!canSave && <p className="muted small">Enter a GBP or USD amount to save.</p>}
    </form>
  );
}
