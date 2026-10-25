/**
 * Season totals: plants sold, gross taken, shipping collected and unpaid outstanding, by week,
 * month and season, read straight from the sales record. A season is a calendar year, the span a
 * tax preparer works in.
 *
 * Plants sold counts every lot a buyer kept, paid or still waiting. Gross taken counts only lots
 * marked paid, plus lots entered by hand. Shipping is one flat charge per paying buyer per showcase,
 * as the payment reminder asks for it; showcases with tiered shipping add nothing, since the app
 * can't know what each buyer paid. Unpaid is the plant money still waiting.
 *
 * Plants sold and unpaid count on the day the showcase closed. Gross taken and shipping collected
 * count on the day they were marked paid, on the screen and in the export alike.
 */
import { buyerKey } from './buyers';
import { MONTHS, formatDay, parseDay, toDay } from './text';
import type { Sale, SaleRecord } from './types';

export type Span = 'week' | 'month' | 'season';

export interface Totals {
  plants: number;
  gross: number;
  shipping: number;
  unpaid: number;
}

export interface PeriodTotals extends Totals {
  key: string;
  label: string;
}

/** Weeks start on Sunday. */
export function periodOf(day: string, span: Span): { key: string; label: string } {
  const { y, m, d } = parseDay(day);
  if (span === 'season') return { key: String(y), label: `${y} season` };
  if (span === 'month') return { key: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTHS[m - 1]} ${y}` };
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - date.getDay());
  const start = toDay(date);
  return { key: start, label: `Week of ${formatDay(start)}` };
}

const empty = (): Totals => ({ plants: 0, gross: 0, shipping: 0, unpaid: 0 });

/**
 * The flat shipping a showcase charged. It's kept on the showcase when it closes; one closed before
 * that falls back to the profile's flat amount today.
 */
function shippingFor(sale: Sale | undefined, fallback: number | null): number {
  if (sale && sale.shippingCharge !== undefined) return sale.shippingCharge ?? 0;
  return fallback ?? 0;
}

/** When money came in: the day it was marked paid, or the record's own day for hand entries and older marks. */
const takenOn = (r: SaleRecord) => r.paidDate ?? r.date;

/**
 * Totals for each period with any sales in it, newest first. Plants sold and unpaid count on the
 * record's day; gross taken and shipping collected count on the day they were paid.
 */
export function seasonTotals(records: SaleRecord[], sales: Sale[], span: Span, fallbackShipping: number | null): PeriodTotals[] {
  const periods = new Map<string, PeriodTotals>();
  const at = (day: string) => {
    const p = periodOf(day, span);
    if (!periods.has(p.key)) periods.set(p.key, { ...p, ...empty() });
    return periods.get(p.key)!;
  };
  const shipped = new Set<string>();
  for (const r of records) {
    if (r.payment === 'never') continue;
    const t = at(r.date);
    const money = at(takenOn(r));
    t.plants += 1;
    const price = r.price ?? 0;
    if (r.saleId === null || r.payment === 'paid') money.gross += price;
    else t.unpaid += price;
    if (r.saleId !== null && r.payment === 'paid') {
      const once = `${r.saleId}:${buyerKey(r.buyer)}`;
      if (!shipped.has(once)) {
        shipped.add(once);
        money.shipping += shippingFor(sales.find((s) => s.id === r.saleId), fallbackShipping);
      }
    }
  }
  return [...periods.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

/** True when some showcase in the record had tiered shipping, so its shipping isn't counted. */
export function hasUncountedShipping(records: SaleRecord[], sales: Sale[]): boolean {
  return sales.some((s) => s.shippingCharge === null && records.some((r) => r.saleId === s.id));
}

const money = (n: number) => n.toFixed(2);

/**
 * One season month by month, with the season total last: a clean file for a tax preparer or a
 * spreadsheet. Gross taken and shipping collected count in the month they were paid.
 */
export function seasonCsv(records: SaleRecord[], sales: Sale[], year: string, fallbackShipping: number | null): string {
  const months = seasonTotals(records, sales, 'month', fallbackShipping)
    .filter((m) => m.key.startsWith(`${year}-`))
    .reverse();
  const total = seasonTotals(records, sales, 'season', fallbackShipping).find((s) => s.key === year) ?? empty();
  const row = (label: string, t: Totals) => [label, String(t.plants), money(t.gross), money(t.shipping), money(t.gross + t.shipping), money(t.unpaid)];
  const rows = [
    ['Period', 'Plants sold', 'Gross taken', 'Shipping collected', 'Taken with shipping', 'Unpaid outstanding'],
    ...months.map((m) => row(m.label, m)),
    row(`${year} total`, total),
  ];
  return rows.map((r) => r.join(',')).join('\r\n') + '\r\n';
}
