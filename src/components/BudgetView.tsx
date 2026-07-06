import { useState } from 'react';
import type { Category, Expense } from '../types';
import { money, parseAmount } from '../lib/format';
import { budgetByCategory, budgetGrandTotal, type BudgetRow } from '../lib/budget';

interface Props {
  expenses: Expense[];
  budget: Partial<Record<Category, number>>;
  onSetBudget: (category: Category, amount: number | null) => void;
}

export function BudgetView({ expenses, budget, onSetBudget }: Props) {
  const rows = budgetByCategory(expenses, budget);
  const total = budgetGrandTotal(rows);

  return (
    <div className="stack budget-tiles">
      {rows.map((r) => (
        <Tile key={r.category} row={r} onSetBudget={onSetBudget} />
      ))}

      <div className="card budget-tile budget-tile--total">
        <div className="budget-tile__head">
          <span className="budget-tile__cat">Total</span>
        </div>
        <div className="budget-tile__stats budget-tile__stats--total">
          <Stat label="Budget" value={money(total.budgetUsd, 'USD')} />
          <Stat label="Actual" value={money(total.actualUsd, 'USD')} />
          <Stat label="Planned" value={money(total.plannedUsd, 'USD')} />
          <Stat
            label="Remaining"
            value={money(total.remainingUsd, 'USD')}
            warn={total.remainingUsd < 0}
          />
        </div>
      </div>
    </div>
  );
}

interface TileProps {
  row: BudgetRow;
  onSetBudget: (category: Category, amount: number | null) => void;
}

function Tile({ row, onSetBudget }: TileProps) {
  const [text, setText] = useState(row.budgetUsd > 0 ? String(row.budgetUsd) : '');
  const overBudget = row.remainingUsd < 0;

  return (
    <div className="card budget-tile">
      <div className="budget-tile__head">
        <span className="budget-tile__cat">{row.category}</span>
        {overBudget && <span className="tag tag--over">over budget</span>}
      </div>

      <label className="field budget-tile__budget">
        <span>Budget (USD)</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
          aria-label={`${row.category} budget`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onSetBudget(row.category, parseAmount(e.target.value));
          }}
        />
      </label>

      <div className="budget-tile__stats">
        <Stat label="Actual" value={money(row.actualUsd, 'USD')} />
        <Stat label="Planned" value={money(row.plannedUsd, 'USD')} />
        <Stat label="Remaining" value={money(row.remainingUsd, 'USD')} warn={overBudget} />
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="budget-tile__stat">
      <span className="budget-tile__stat-label">{label}</span>
      <span className={`budget-tile__stat-value${warn ? ' budget-tile__stat-value--over' : ''}`}>
        {value}
      </span>
    </div>
  );
}
