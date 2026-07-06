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
  columns = 7,
) {
  const ws = wb.getWorksheet(sheet)!;
  let found: (string | number | null)[] | undefined;
  ws.eachRow((row) => {
    if (row.getCell(1).value === firstCell) {
      found = Array.from({ length: columns }, (_, i) => i + 1).map(
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

  it('produces a Totals sheet, a Budget sheet, and an Expenses sheet', async () => {
    const buf = await buildXlsx([
      exp({ category: 'Accommodation', amount_gbp: 80, amount_usd: 100, note: 'hotel' }),
    ]);
    const wb = await readBack(buf);

    expect(wb.worksheets.map((w) => w.name)).toEqual(['Totals', 'Budget', 'Expenses']);

    const acc = findRow(wb, 'Totals', 'Accommodation', 4);
    expect(acc?.[1]).toBe(80); // GBP
    expect(acc?.[2]).toBe(100); // USD

    const raw = findRow(wb, 'Expenses', '2026-07-01');
    expect(raw?.[1]).toBe('Accommodation');
    expect(raw?.[2]).toBe(80);
    expect(raw?.[3]).toBe(100);
    expect(raw?.[6]).toBe('hotel');
  });

  it('flags a USD-pending category row and the pending expense row', async () => {
    const buf = await buildXlsx([
      exp({ category: 'Accommodation', amount_gbp: 80, amount_usd: null }),
    ]);
    const wb = await readBack(buf);

    const acc = findRow(wb, 'Totals', 'Accommodation', 4);
    expect(acc?.[3]).toBe('1'); // USD pending count

    const raw = findRow(wb, 'Expenses', '2026-07-01');
    expect(raw?.[4]).toBe('yes');
  });

  it('flags a planned expense row on the Expenses sheet', async () => {
    const buf = await buildXlsx([
      exp({ category: 'Accommodation', amount_usd: 650, status: 'planned' }),
    ]);
    const wb = await readBack(buf);

    const raw = findRow(wb, 'Expenses', '2026-07-01');
    expect(raw?.[5]).toBe('yes'); // Planned column
  });

  it('excludes planned expenses from the Totals sheet', async () => {
    const buf = await buildXlsx([
      exp({ category: 'Accommodation', amount_gbp: 500, amount_usd: 650, status: 'planned' }),
    ]);
    const wb = await readBack(buf);

    const acc = findRow(wb, 'Totals', 'Accommodation', 4);
    expect(acc?.[1]).toBe(0);
    expect(acc?.[2]).toBe(0);
  });

  it('includes a grand total row on the Totals sheet', async () => {
    const buf = await buildXlsx([
      exp({ category: 'Transport', amount_gbp: 10, amount_usd: 12 }),
    ]);
    const wb = await readBack(buf);
    const total = findRow(wb, 'Totals', 'TOTAL', 4);
    expect(total?.[1]).toBe(10);
    expect(total?.[2]).toBe(12);
  });
});

describe('buildXlsx budget sheet', () => {
  it('renders budget vs. actual vs. planned per category, plus a grand total', async () => {
    const buf = await buildXlsx(
      [
        exp({ category: 'Food & Dining', amount_usd: 100, status: 'actual' }),
        exp({ category: 'Accommodation', amount_usd: 650, status: 'planned' }),
      ],
      { 'Food & Dining': 1000, Accommodation: 1200 },
    );
    const wb = await readBack(buf);

    const food = findRow(wb, 'Budget', 'Food & Dining', 5);
    expect(food).toEqual(['Food & Dining', 1000, 100, 0, 900]);

    const stay = findRow(wb, 'Budget', 'Accommodation', 5);
    expect(stay).toEqual(['Accommodation', 1200, 0, 650, 550]);

    const total = findRow(wb, 'Budget', 'TOTAL', 5);
    expect(total).toEqual(['TOTAL', 2200, 100, 650, 1450]);
  });

  it('highlights over-budget categories', async () => {
    const buf = await buildXlsx(
      [exp({ category: 'Misc', amount_usd: 150, status: 'actual' })],
      { Misc: 100 },
    );
    const wb = await readBack(buf);
    const ws = wb.getWorksheet('Budget')!;
    let overRow: ReturnType<typeof ws.getRow> | undefined;
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Misc') overRow = row;
    });
    expect(overRow?.getCell(1).fill).toBeTruthy();
  });
});
