import type { Expense } from '../types';
import { money } from '../lib/format';
import { grandTotal, totalsByCategory, usdPendingCountsByCategory } from '../lib/totals';

interface Props {
  expenses: Expense[];
}

export function TotalsView({ expenses }: Props) {
  const byCategory = totalsByCategory(expenses);
  const pending = usdPendingCountsByCategory(expenses);
  const total = grandTotal(byCategory);

  return (
    <div className="stack">
      <table className="totals">
        <thead>
          <tr>
            <th>Category</th>
            <th className="num">GBP</th>
            <th className="num">USD</th>
          </tr>
        </thead>
        <tbody>
          {byCategory.map((r) => {
            const pendingCount = pending.get(r.category) ?? 0;
            return (
              <tr key={r.category}>
                <th scope="row">
                  {r.category}
                  {pendingCount > 0 && (
                    <span className="tag tag--warn">{pendingCount} missing USD</span>
                  )}
                </th>
                <td className="num">{money(r.gbp, 'GBP')}</td>
                <td className="num">{money(r.usd, 'USD')}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <th className="num">{money(total.gbp, 'GBP')}</th>
            <th className="num">{money(total.usd, 'USD')}</th>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
