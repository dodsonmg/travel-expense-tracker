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
    <div className="stack">
      <table className="totals">
        <thead>
          <tr>
            <th>Category</th>
            <th className="num">Budget</th>
            <th className="num">Actual</th>
            <th className="num">Planned</th>
            <th className="num">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.category} row={r} onSetBudget={onSetBudget} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <th className="num">{money(total.budgetUsd, 'USD')}</th>
            <th className="num">{money(total.actualUsd, 'USD')}</th>
            <th className="num">{money(total.plannedUsd, 'USD')}</th>
            <th className="num">{money(total.remainingUsd, 'USD')}</th>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

interface RowProps {
  row: BudgetRow;
  onSetBudget: (category: Category, amount: number | null) => void;
}

function Row({ row, onSetBudget }: RowProps) {
  const [text, setText] = useState(row.budgetUsd > 0 ? String(row.budgetUsd) : '');
  const overBudget = row.remainingUsd < 0;

  return (
    <tr>
      <th scope="row">
        {row.category}
        {overBudget && <span className="tag tag--over">over budget</span>}
      </th>
      <td className="num">
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
      </td>
      <td className="num">{money(row.actualUsd, 'USD')}</td>
      <td className="num">{money(row.plannedUsd, 'USD')}</td>
      <td className="num">{money(row.remainingUsd, 'USD')}</td>
    </tr>
  );
}
