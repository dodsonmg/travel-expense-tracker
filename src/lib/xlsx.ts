import type { Expense } from '../types';
import { buildReport } from './report';

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function xlsxFilename(now = new Date()): string {
  return `trip-expenses-${now.toISOString().slice(0, 10)}.xlsx`;
}

const MONEY_FMT = '#,##0.00';
// as const keeps the literal types ExcelJS's Fill union expects.
const headFill = () =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF4' } }) as const;
// USD-pending data means the charge hasn't landed on the card yet — the row
// still needs a USD amount backfilled.
const pendingFill = () =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7EFC0' } }) as const;

// A formatted workbook: a Totals sheet (by category, USD-pending rows
// highlighted) followed by an Expenses sheet (raw rows). ExcelJS is heavy, so
// it's dynamically imported here to stay out of the main bundle; the split
// chunk is still precached for offline export.
export async function buildXlsx(expenses: Expense[]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs');
  const report = buildReport(expenses);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Travel Expense Tracker';
  wb.created = new Date();

  // --- Totals sheet ---
  const totals = wb.addWorksheet('Totals');
  totals.columns = [16, 12, 12, 14].map((width) => ({ width }));

  const title = totals.addRow(['Trip Expense Totals']);
  title.font = { bold: true, size: 14 };
  totals.addRow([`Exported ${new Date().toISOString().slice(0, 10)}`]);
  totals.addRow([]);

  const header = totals.addRow(['Category', 'GBP', 'USD', 'USD pending']);
  header.font = { bold: true };
  for (let i = 1; i <= 4; i++) header.getCell(i).fill = headFill();

  for (const r of report.categories) {
    const pending = r.usdPendingCount > 0;
    const row = totals.addRow([
      r.category,
      r.gbp,
      r.usd,
      pending ? `${r.usdPendingCount}` : '',
    ]);
    row.getCell(2).numFmt = MONEY_FMT;
    row.getCell(3).numFmt = MONEY_FMT;
    if (pending) {
      for (let i = 1; i <= 4; i++) row.getCell(i).fill = pendingFill();
    }
  }

  const totalRow = totals.addRow([
    'TOTAL',
    report.grandTotal.gbp,
    report.grandTotal.usd,
    '',
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(2).numFmt = MONEY_FMT;
  totalRow.getCell(3).numFmt = MONEY_FMT;

  // --- Expenses sheet: raw rows ---
  const exp = wb.addWorksheet('Expenses');
  exp.columns = [
    { header: 'Date', width: 12 },
    { header: 'Category', width: 16 },
    { header: 'GBP', width: 10 },
    { header: 'USD', width: 10 },
    { header: 'USD pending', width: 12 },
    { header: 'Note', width: 28 },
  ];
  exp.getRow(1).font = { bold: true };
  for (const e of report.expenses) {
    const row = exp.addRow([
      e.date,
      e.category,
      e.amountGbp,
      e.amountUsd,
      e.usdPending ? 'yes' : '',
      e.note,
    ]);
    row.getCell(3).numFmt = MONEY_FMT;
    row.getCell(4).numFmt = MONEY_FMT;
    if (e.usdPending) {
      for (let i = 1; i <= 6; i++) row.getCell(i).fill = pendingFill();
    }
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
