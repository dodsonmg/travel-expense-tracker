import type { Expense, Trip } from '../types';
import { money } from '../lib/format';
import { sumBudgetTotals, tripBudgetTotal, type BudgetTotal } from '../lib/budget';

interface Props {
  trips: Trip[];
  expensesByTripId: Record<string, Expense[]>;
  loaded: boolean;
  onSelectTrip: (tripId: string) => void;
}

// Cross-trip counterpart to BudgetView's Total tile: one tile per
// non-archived trip, plus a grand-total tile summing across all of them.
export function RollupView({ trips, expensesByTripId, loaded, onSelectTrip }: Props) {
  if (!loaded) return <p className="muted">Loading…</p>;

  const visibleTrips = trips.filter((t) => !t.archived);

  if (visibleTrips.length === 0) {
    return <p className="muted">All trips are archived.</p>;
  }

  const totals = visibleTrips.map((t) =>
    tripBudgetTotal(expensesByTripId[t.id] ?? [], t.budget_usd ?? {}),
  );
  const grandTotal = sumBudgetTotals(totals);

  return (
    <div className="stack budget-tiles">
      {visibleTrips.map((t, i) => (
        <Tile
          key={t.id}
          name={t.name}
          total={totals[i]}
          onClick={() => onSelectTrip(t.id)}
        />
      ))}

      <div className="card budget-tile budget-tile--total">
        <div className="budget-tile__head">
          <span className="budget-tile__cat">All trips</span>
        </div>

        <div className="field budget-tile__budget">
          <span>Budget (USD)</span>
          <span className="budget-tile__budget-value">{money(grandTotal.budgetUsd, 'USD')}</span>
        </div>

        <div className="budget-tile__stats">
          <Stat label="Actual" value={money(grandTotal.actualUsd, 'USD')} />
          <Stat label="Planned" value={money(grandTotal.plannedUsd, 'USD')} />
          <Stat
            label="Remaining"
            value={money(grandTotal.remainingUsd, 'USD')}
            warn={grandTotal.remainingUsd < 0}
          />
        </div>
      </div>
    </div>
  );
}

interface TileProps {
  name: string;
  total: BudgetTotal;
  onClick: () => void;
}

function Tile({ name, total, onClick }: TileProps) {
  const overBudget = total.remainingUsd < 0;

  return (
    <button
      type="button"
      className="card budget-tile budget-tile--clickable"
      onClick={onClick}
    >
      <div className="budget-tile__head">
        <span className="budget-tile__cat">{name}</span>
        {overBudget && <span className="tag tag--over">over budget</span>}
      </div>

      <div className="field budget-tile__budget">
        <span>Budget (USD)</span>
        <span className="budget-tile__budget-value">{money(total.budgetUsd, 'USD')}</span>
      </div>

      <div className="budget-tile__stats">
        <Stat label="Actual" value={money(total.actualUsd, 'USD')} />
        <Stat label="Planned" value={money(total.plannedUsd, 'USD')} />
        <Stat label="Remaining" value={money(total.remainingUsd, 'USD')} warn={overBudget} />
      </div>
    </button>
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
