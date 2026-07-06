import { describe, it, expect } from 'vitest';
import { buildXlsx, xlsxFilename } from './xlsx';
import type { Expense } from '../types';

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e',
  tripId: 't',
  date: '2026-07-01',
  category: 'Accommodation',
  amount_gbp: null,
  amount_usd: null,
  note: '',
  ...over,
});

// Round-trip: write the workbook, read it back, assert on structure/values.
// Styling (fills) is intentionally not asserted.
async function readBack(buf: ArrayBuffer) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

function findRow(
  wb: Awaited<ReturnType<typeof readBack>>,
  sheet: string,
  firstCell: string,
) {
  const ws = wb.getWorksheet(sheet)!;
  let found: (string | number | null)[] | undefined;
  ws.eachRow((row) => {
    if (row.getCell(1).value === firstCell) {
      found = [1, 2, 3, 4, 5, 6].map(
        (i) => row.getCell(i).value as string | number | null,
      );
    }
  });
  return found;
}

describe('buildXlsx', () => {
  it('has the expected filename', () => {
    expect(xlsxFilename(new Date('2026-07-04T12:00:00Z'))).toBe(
      'trip-expenses-2026-07-04.xlsx',
    );
  });

  it('produces a Totals sheet and an Expenses sheet', async () => {
    const buf = await buildXlsx([
      exp({ category: 'Accommodation', amount_gbp: 80, amount_usd: 100, note: 'hotel' }),
    ]);
    const wb = await readBack(buf);

    expect(wb.worksheets.map((w) => w.name)).toEqual(['Totals', 'Expenses']);

    const acc = findRow(wb, 'Totals', 'Accommodation');
    expect(acc?.[1]).toBe(80); // GBP
    expect(acc?.[2]).toBe(100); // USD

    const raw = findRow(wb, 'Expenses', '2026-07-01');
    expect(raw?.[1]).toBe('Accommodation');
    expect(raw?.[2]).toBe(80);
    expect(raw?.[3]).toBe(100);
    expect(raw?.[5]).toBe('hotel');
  });

  it('flags a USD-pending category row and the pending expense row', async () => {
    const buf = await buildXlsx([
      exp({ category: 'Accommodation', amount_gbp: 80, amount_usd: null }),
    ]);
    const wb = await readBack(buf);

    const acc = findRow(wb, 'Totals', 'Accommodation');
    expect(acc?.[3]).toBe('1'); // USD pending count

    const raw = findRow(wb, 'Expenses', '2026-07-01');
    expect(raw?.[4]).toBe('yes');
  });

  it('includes a grand total row on the Totals sheet', async () => {
    const buf = await buildXlsx([
      exp({ category: 'Transport', amount_gbp: 10, amount_usd: 12 }),
    ]);
    const wb = await readBack(buf);
    const total = findRow(wb, 'Totals', 'TOTAL');
    expect(total?.[1]).toBe(10);
    expect(total?.[2]).toBe(12);
  });
});
