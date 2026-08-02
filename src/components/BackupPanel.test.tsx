import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackupPanel } from './BackupPanel';
import type { Trip } from '../types';
import { BACKUP_FORMAT, BACKUP_VERSION } from '../lib/backup';

const trips: Trip[] = [{ id: 't1', name: 'My Trip', createdAt: '2026-01-01' }];

const exportBackup = vi.fn();
const restoreBackup = vi.fn();

vi.mock('../useBackup', () => ({
  useBackup: () => ({ exportBackup, restoreBackup }),
}));

// downloadBlob touches the DOM (createObjectURL/anchor click) — stub it out,
// matching how ExportView.test.tsx avoids exercising real download plumbing.
vi.mock('../lib/share', () => ({
  downloadBlob: vi.fn(),
}));

beforeEach(() => {
  exportBackup.mockReset();
  restoreBackup.mockReset();
});

function validBackupFile() {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: '2026-08-01T00:00:00.000Z',
    activeTripId: 't1',
    trips: [{ id: 't1', name: 'Restored Trip', createdAt: '2026-01-01' }],
    expenses: { t1: [] },
  };
}

describe('BackupPanel', () => {
  it('shows "never" when no backup has been made', () => {
    render(
      <BackupPanel trips={trips} activeTripId="t1" lastBackup={null} onBackedUp={vi.fn()} />,
    );
    expect(screen.getByText(/last backup: never/i)).toBeInTheDocument();
  });

  it('shows a relative time when a backup exists', () => {
    render(
      <BackupPanel
        trips={trips}
        activeTripId="t1"
        lastBackup={{ at: new Date(Date.now() - 2 * 86_400_000).toISOString(), expenseCount: 3 }}
        onBackedUp={vi.fn()}
      />,
    );
    expect(screen.getByText(/last backup: 2 days ago/i)).toBeInTheDocument();
  });

  it('downloading a backup calls exportBackup and onBackedUp', async () => {
    exportBackup.mockResolvedValue({
      blob: new Blob(['{}']),
      name: 'travel-expense-tracker-backup-2026-08-02.json',
      file: validBackupFile(),
    });
    const onBackedUp = vi.fn();
    const user = userEvent.setup();
    render(
      <BackupPanel trips={trips} activeTripId="t1" lastBackup={null} onBackedUp={onBackedUp} />,
    );

    await user.click(screen.getByRole('button', { name: /download backup/i }));

    await waitFor(() => expect(onBackedUp).toHaveBeenCalled());
    expect(screen.getByText(/saved travel-expense-tracker-backup/i)).toBeInTheDocument();
  });

  it('selecting an invalid file shows an error, no confirm card', async () => {
    const user = userEvent.setup();
    render(
      <BackupPanel trips={trips} activeTripId="t1" lastBackup={null} onBackedUp={vi.fn()} />,
    );

    const file = new File(['not json'], 'bad.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText(/isn't a valid backup/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
  });

  it('selecting a valid backup file shows a confirm card before restoring', async () => {
    const user = userEvent.setup();
    render(
      <BackupPanel trips={trips} activeTripId="t1" lastBackup={null} onBackedUp={vi.fn()} />,
    );

    const file = new File([JSON.stringify(validBackupFile())], 'backup.json', {
      type: 'application/json',
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText(/can't be undone/i)).toBeInTheDocument();
    expect(restoreBackup).not.toHaveBeenCalled();
  });

  it('confirming restore calls restoreBackup and onBackedUp', async () => {
    restoreBackup.mockResolvedValue(undefined);
    // jsdom's window.location.reload is non-configurable, so swap the whole
    // location object out for the duration of this test.
    const originalLocation = window.location;
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
    const onBackedUp = vi.fn();
    const user = userEvent.setup();
    render(
      <BackupPanel trips={trips} activeTripId="t1" lastBackup={null} onBackedUp={onBackedUp} />,
    );

    const file = new File([JSON.stringify(validBackupFile())], 'backup.json', {
      type: 'application/json',
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    await user.click(await screen.findByRole('button', { name: 'Restore' }));

    await waitFor(() => expect(restoreBackup).toHaveBeenCalled());
    expect(onBackedUp).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('canceling a pending restore dismisses the confirm card without restoring', async () => {
    const user = userEvent.setup();
    render(
      <BackupPanel trips={trips} activeTripId="t1" lastBackup={null} onBackedUp={vi.fn()} />,
    );

    const file = new File([JSON.stringify(validBackupFile())], 'backup.json', {
      type: 'application/json',
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/can't be undone/i)).not.toBeInTheDocument();
    expect(restoreBackup).not.toHaveBeenCalled();
  });
});
