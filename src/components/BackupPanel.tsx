import { useRef, useState } from 'react';
import type { Trip } from '../types';
import type { LastBackupInfo } from '../db';
import { useBackup } from '../useBackup';
import { downloadBlob } from '../lib/share';
import { validateBackupFile, type BackupFileV1 } from '../lib/backup';

interface Props {
  trips: Trip[];
  activeTripId: string;
  lastBackup: LastBackupInfo | null;
  onBackedUp: () => void;
}

function relativeDays(at: string): string {
  const days = Math.floor((Date.now() - Date.parse(at)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// A full, round-trippable JSON backup of every trip and expense on the
// device — distinct from the exports above, which are lossy/single-trip and
// meant for reading or sharing, not restoring. Rendered inside ExportView
// rather than a separate tab.
export function BackupPanel({ trips, activeTripId, lastBackup, onBackedUp }: Props) {
  const { exportBackup, restoreBackup } = useBackup(activeTripId);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: BackupFileV1; rawText: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleBackup() {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const { blob, name } = await exportBackup();
      downloadBlob(blob, name);
      setStatus(`Saved ${name}`);
      onBackedUp();
    } catch {
      setError('Backup failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setError(null);
    setStatus(null);
    const rawText = await file.text();
    let json: unknown;
    try {
      json = JSON.parse(rawText);
    } catch {
      setPending(null);
      setError("That file isn't a valid backup: it's not valid JSON.");
      return;
    }
    try {
      const parsed = validateBackupFile(json);
      setPending({ file: parsed, rawText });
    } catch (err) {
      setPending(null);
      setError(err instanceof Error ? err.message : 'That file is not a valid backup.');
    }
  }

  async function confirmRestore() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await restoreBackup(pending.rawText);
      onBackedUp();
      window.location.reload();
    } catch {
      setError('Restore failed. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <p className="muted small">
        A full backup of every trip and expense, for safekeeping or a new
        device — restores exactly. The exports above are for reading or
        sharing, not restoring.
      </p>

      <p className="muted small">
        Last backup: {lastBackup ? relativeDays(lastBackup.at) : 'never'}
      </p>

      <button type="button" className="btn" disabled={busy} onClick={handleBackup}>
        Download backup (.json)
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="visually-hidden"
        onChange={handleFileSelected}
      />
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
      >
        Restore from backup…
      </button>

      {pending && (
        <div className="card stack">
          <p>
            This will replace all {trips.length} trip(s) on this device with
            the {pending.file.trips.length} trip(s) from this backup (made{' '}
            {new Date(pending.file.exportedAt).toLocaleString()}). This
            can&apos;t be undone.
          </p>
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy}
            onClick={confirmRestore}
          >
            Restore
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => setPending(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {status && <p className="muted small">{status}</p>}
      {error && <p className="muted small">{error}</p>}
    </div>
  );
}
