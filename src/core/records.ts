import { formatLongDate, formatPrice } from './text';
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

export interface PriceMemory {
  price: number;
  /** YYYY-MM-DD */
  date: string;
}

/** A plant name with case, spaces and punctuation set aside, so "Krimson-Queen" finds "krimson queen". */
export const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The last price a plant name sold for, and when. NOIDs and blank names have no memory, since two
 * plants under the same NOID label aren't the same plant. Lots never paid for don't count.
 */
export function lastSold(records: SaleRecord[], name: string, noid: boolean, exceptSaleId?: string): PriceMemory | null {
  const k = nameKey(name);
  if (noid || !k) return null;
  let best: PriceMemory | null = null;
  for (const r of records) {
    if (r.price === null || r.payment === 'never' || (exceptSaleId && r.saleId === exceptSaleId)) continue;
    if (nameKey(r.plantName) !== k) continue;
    if (!best || r.date > best.date) best = { price: r.price, date: r.date };
  }
  return best;
}

export function priceMemoryLine(m: PriceMemory): string {
  return `Last sold for ${formatPrice(m.price)} on ${formatLongDate(m.date)}`;
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
