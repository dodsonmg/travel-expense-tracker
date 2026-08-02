import { useState } from 'react';
import type { Category, Expense, Trip } from '../types';
import type { LastBackupInfo } from '../db';
import { buildCsv, csvFilename } from '../lib/csv';
import { buildXlsx, xlsxFilename, XLSX_MIME } from '../lib/xlsx';
import { downloadBlob, shareBlob } from '../lib/share';
import { BackupPanel } from './BackupPanel';

interface Props {
  expenses: Expense[];
  budget: Partial<Record<Category, number>>;
  tripName: string;
  trips: Trip[];
  activeTripId: string;
  lastBackup: LastBackupInfo | null;
  onBackedUp: () => void;
}

// Export to keep or share. A formatted .xlsx (totals sheet up top) is
// primary; a plain CSV is kept as a lightweight fallback. Sharing uses the
// Web Share API (mobile share sheet) with a download fallback. The full
// cross-trip JSON backup/restore lives below in BackupPanel — conceptually
// adjacent ("get my data out"), not a separate tab.
export function ExportView({
  expenses,
  budget,
  tripName,
  trips,
  activeTripId,
  lastBackup,
  onBackedUp,
}: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const empty = expenses.length === 0;

  async function makeXlsx(): Promise<{ blob: Blob; name: string }> {
    const buf = await buildXlsx(expenses, budget, tripName);
    return {
      blob: new Blob([buf], { type: XLSX_MIME }),
      name: xlsxFilename(tripName),
    };
  }

  function makeCsv(): { blob: Blob; name: string } {
    const csv = buildCsv(expenses, budget);
    return {
      blob: new Blob([csv], { type: 'text/csv' }),
      name: csvFilename(tripName),
    };
  }

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
    } catch {
      setStatus('Export failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <p className="muted small">
        A formatted <strong>.xlsx</strong> with a totals-by-category sheet up
        top and the raw rows behind it. CSV is also available.
      </p>

      <button
        type="button"
        className="btn btn--primary btn--big"
        disabled={empty || busy}
        onClick={() =>
          withBusy(async () => {
            const { blob, name } = await makeXlsx();
            const result = await shareBlob(blob, name, XLSX_MIME);
            setStatus(result === 'shared' ? 'Shared.' : `Saved ${name}`);
          })
        }
      >
        ⇪ Export &amp; share .xlsx
      </button>
      <button
        type="button"
        className="btn"
        disabled={empty || busy}
        onClick={() =>
          withBusy(async () => {
            const { blob, name } = await makeXlsx();
            downloadBlob(blob, name);
            setStatus(`Saved ${name}`);
          })
        }
      >
        Download .xlsx
      </button>
      <button
        type="button"
        className="btn"
        disabled={empty || busy}
        onClick={() => {
          const { blob, name } = makeCsv();
          downloadBlob(blob, name);
          setStatus(`Saved ${name}`);
        }}
      >
        Download CSV
      </button>

      {busy && <p className="muted small">Building spreadsheet…</p>}
      {empty && <p className="muted">Nothing to export yet.</p>}
      {status && !busy && <p className="muted small">{status}</p>}

      <BackupPanel
        trips={trips}
        activeTripId={activeTripId}
        lastBackup={lastBackup}
        onBackedUp={onBackedUp}
      />
    </div>
  );
}
