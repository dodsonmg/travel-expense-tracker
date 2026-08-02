import type { Expense, Trip } from '../types';

// A full, round-trippable snapshot of every trip and expense on the device —
// unlike csv.ts/xlsx.ts, which are lossy, single-trip, human-readable
// exports. Pure module: no db.ts import, same boundary those keep; the
// db-touching read/write lives in useBackup.ts.
export const BACKUP_FORMAT = 'travel-expense-tracker-backup' as const;
export const BACKUP_VERSION = 1;

export interface BackupFileV1 {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string; // ISO timestamp
  activeTripId: string;
  trips: Trip[];
  expenses: Record<string, Expense[]>; // keyed by Trip.id
}

export function buildBackupFile(
  trips: Trip[],
  expensesByTripId: Record<string, Expense[]>,
  activeTripId: string,
): BackupFileV1 {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    activeTripId,
    trips,
    expenses: expensesByTripId,
  };
}

// Validates an arbitrary parsed-JSON value as a restorable backup, throwing
// a specific, user-legible Error per failure rather than a generic "invalid
// input" — restoreBackup relies on this throwing before any storage write.
// Lenient about a trip missing its own expenses entry (defaults to []), same
// `?? []` philosophy db.ts already uses elsewhere.
export function validateBackupFile(raw: unknown): BackupFileV1 {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error("This doesn't look like a Travel Expense Tracker backup file.");
  }
  const obj = raw as Record<string, unknown>;

  if (obj.format !== BACKUP_FORMAT) {
    throw new Error("This doesn't look like a Travel Expense Tracker backup file.");
  }
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) {
    throw new Error(
      'This backup was made with a newer version of the app; update the app first.',
    );
  }
  if (!Array.isArray(obj.trips) || obj.trips.length === 0) {
    throw new Error('The backup has no trips.');
  }
  for (const t of obj.trips) {
    if (
      typeof t !== 'object' ||
      t === null ||
      typeof (t as Trip).id !== 'string' ||
      typeof (t as Trip).name !== 'string' ||
      typeof (t as Trip).createdAt !== 'string'
    ) {
      throw new Error('A trip in the backup is missing required fields.');
    }
  }

  const trips = obj.trips as Trip[];
  const rawExpenses =
    typeof obj.expenses === 'object' && obj.expenses !== null
      ? (obj.expenses as Record<string, unknown>)
      : {};
  const expenses: Record<string, Expense[]> = {};
  for (const t of trips) {
    const forTrip = rawExpenses[t.id];
    expenses[t.id] = Array.isArray(forTrip) ? (forTrip as Expense[]) : [];
  }

  const activeTripId =
    typeof obj.activeTripId === 'string' && trips.some((t) => t.id === obj.activeTripId)
      ? obj.activeTripId
      : trips[0].id;

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    activeTripId,
    trips,
    expenses,
  };
}

// Date-stamped, no trip-name slug since a backup spans every trip.
export function backupFilename(now = new Date()): string {
  return `travel-expense-tracker-backup-${now.toISOString().slice(0, 10)}.json`;
}
