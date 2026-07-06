import { useState } from 'react';
import { useTrips } from './useTrips';
import { useTripData } from './useTripData';
import { EntryForm } from './components/EntryForm';
import { ExpenseList } from './components/ExpenseList';
import { TotalsView } from './components/TotalsView';
import { BudgetView } from './components/BudgetView';
import { ExportView } from './components/ExportView';
import { TripSwitcher } from './components/TripSwitcher';
import { UpdateToast } from './components/UpdateToast';

const TABS = [
  { id: 'entry', label: 'Entry', icon: '＋' },
  { id: 'list', label: 'List', icon: '☰' },
  { id: 'totals', label: 'Totals', icon: 'Σ' },
  { id: 'budget', label: 'Budget', icon: '🎯' },
  { id: 'export', label: 'Export', icon: '⇪' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function App() {
  const [tab, setTab] = useState<TabId>('entry');
  const trips = useTrips();
  const tripData = useTripData(trips.activeTripId);
  const ready = trips.loaded && tripData.loaded;
  const activeTrip = trips.trips.find((t) => t.id === trips.activeTripId);

  function renderTab() {
    switch (tab) {
      case 'entry':
        return (
          <EntryForm onAdd={tripData.addExpense} onDone={() => setTab('list')} />
        );
      case 'list':
        return (
          <ExpenseList
            expenses={tripData.expenses}
            onUpdate={tripData.updateExpense}
            onDelete={tripData.deleteExpense}
          />
        );
      case 'totals':
        return <TotalsView expenses={tripData.expenses} />;
      case 'budget':
        return (
          <BudgetView
            expenses={tripData.expenses}
            budget={activeTrip?.budget_usd ?? {}}
            onSetBudget={(category, amount) =>
              trips.setBudget(trips.activeTripId, category, amount)
            }
          />
        );
      case 'export':
        return (
          <ExportView
            expenses={tripData.expenses}
            budget={activeTrip?.budget_usd ?? {}}
            tripName={activeTrip?.name ?? ''}
          />
        );
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Travel Expense Tracker</h1>
        {trips.loaded && (
          <TripSwitcher
            trips={trips.trips}
            activeTripId={trips.activeTripId}
            onSelect={trips.selectTrip}
            onCreate={trips.createTrip}
            onRename={trips.renameTrip}
            onDelete={trips.deleteTrip}
          />
        )}
      </header>

      <UpdateToast />

      <main className="app__main">
        {!ready ? <p className="muted">Loading…</p> : renderTab()}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tabbar__btn${tab === t.id ? ' tabbar__btn--active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id}
          >
            <span className="tabbar__icon" aria-hidden>
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
