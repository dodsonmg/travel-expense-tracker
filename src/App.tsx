import { useState } from 'react';
import { useTripData } from './useTripData';
import { EntryForm } from './components/EntryForm';
import { ExpenseList } from './components/ExpenseList';
import { TotalsView } from './components/TotalsView';
import { BudgetView } from './components/BudgetView';
import { ExportView } from './components/ExportView';
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
  const trip = useTripData();

  function renderTab() {
    switch (tab) {
      case 'entry':
        return <EntryForm onAdd={trip.addExpense} onDone={() => setTab('list')} />;
      case 'list':
        return (
          <ExpenseList
            expenses={trip.expenses}
            onUpdate={trip.updateExpense}
            onDelete={trip.deleteExpense}
          />
        );
      case 'totals':
        return <TotalsView expenses={trip.expenses} />;
      case 'budget':
        return (
          <BudgetView
            expenses={trip.expenses}
            budget={trip.trip?.budget_usd ?? {}}
            onSetBudget={trip.setBudget}
          />
        );
      case 'export':
        return (
          <ExportView expenses={trip.expenses} budget={trip.trip?.budget_usd ?? {}} />
        );
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Travel Expense Tracker</h1>
      </header>

      <UpdateToast />

      <main className="app__main">
        {!trip.loaded ? <p className="muted">Loading…</p> : renderTab()}
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
