import { buildBackupFile, validateBackupFile, backupFilename, type BackupFileV1 } from './lib/backup';
import {
  loadExpenses,
  loadTrips,
  saveActiveTripId,
  saveExpenses,
  saveTrips,
} from './db';
import type { Trip } from './types';

// The IO layer for full JSON backup/restore, mirroring useTrips.ts/
// useTripData.ts being the IO layer while lib/backup.ts stays pure.
export function useBackup(activeTripId: string) {
  async function exportBackup(): Promise<{ blob: Blob; name: string; file: BackupFileV1 }> {
    // Authoritative fresh read — not any in-memory cache (e.g.
    // useAllTripsData's), so the exported file is always correct regardless
    // of any UI-side staleness.
    const freshTrips: Trip[] = (await loadTrips()) ?? [];
    const entries = await Promise.all(
      freshTrips.map(async (t) => [t.id, await loadExpenses(t.id)] as const),
    );
    const file = buildBackupFile(
      freshTrips,
      Object.fromEntries(entries),
      activeTripId || (freshTrips[0]?.id ?? ''),
    );
    const json = JSON.stringify(file, null, 2);
    return {
      blob: new Blob([json], { type: 'application/json' }),
      name: backupFilename(),
      file,
    };
  }

  // Parses/validates before any write, guaranteeing no partial write on a
  // malformed file — validateBackupFile throws first.
  async function restoreBackup(rawText: string): Promise<BackupFileV1> {
    const file = validateBackupFile(JSON.parse(rawText));
    await saveTrips(file.trips);
    await Promise.all(
      file.trips.map((t) => saveExpenses(t.id, file.expenses[t.id] ?? [])),
    );
    await saveActiveTripId(file.activeTripId);
    return file;
  }

  return { exportBackup, restoreBackup };
}
