import { formatPrice } from './text';
import type { SaleRecord } from './types';

export function searchRecords(records: SaleRecord[], query: string): SaleRecord[] {
  const q = query.trim().toLowerCase();
  const sorted = [...records].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (!q) return sorted;
  return sorted.filter((r) =>
    [r.plantName, r.buyer, r.date, formatPrice(r.price), r.lotNumber ? `lot ${r.lotNumber}` : '']
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}

/** Sets a lot's payment. A Paid mark stamps today as the paid date, unless it was already paid. */
export function markPayment(r: SaleRecord, payment: SaleRecord['payment'], today: string): SaleRecord {
  const { paidDate, ...rest } = r;
  if (payment !== 'paid') return { ...rest, payment };
  return { ...rest, payment, paidDate: r.payment === 'paid' && paidDate ? paidDate : today };
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A plain spreadsheet file: date, plant, buyer, price, lot. */
export function recordsToCsv(records: SaleRecord[]): string {
  const rows = [['Date', 'Plant', 'Buyer', 'Price', 'Lot']];
  for (const r of searchRecords(records, '')) {
    rows.push([
      r.date,
      r.plantName,
      r.buyer,
      r.price === null ? '' : r.price.toFixed(2),
      r.lotNumber === null ? '' : String(r.lotNumber),
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
