/**
 * Buyer memory. Built from the sales record alone, so the seller never keeps it by hand.
 * Buyers are matched by the name they claim under.
 */
import { formatPrice } from './text';
import type { SaleRecord } from './types';

export function buyerKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface BuyerHistory {
  name: string;
  /** Sales they've bought in. A sale added by hand counts as one sale. */
  sales: number;
  lots: number;
  /** What they've spent, leaving out lots they never paid for. */
  spent: number;
  /** Sales where something they won isn't marked paid. */
  unpaidSales: number;
}

const saleOf = (r: SaleRecord) => r.saleId ?? `hand:${r.id}`;

/** Every buyer's history, leaving out one sale (the one on screen) when asked. */
export function buyerHistory(records: SaleRecord[], exceptSaleId?: string): Map<string, BuyerHistory> {
  const sales = new Map<string, Set<string>>();
  const unpaid = new Map<string, Set<string>>();
  const out = new Map<string, BuyerHistory>();
  for (const r of records) {
    if (exceptSaleId && r.saleId === exceptSaleId) continue;
    const k = buyerKey(r.buyer);
    if (!k) continue;
    const h = out.get(k) ?? { name: r.buyer, sales: 0, lots: 0, spent: 0, unpaidSales: 0 };
    h.lots += 1;
    if (r.payment !== 'never') h.spent += r.price ?? 0;
    const s = sales.get(k) ?? new Set();
    s.add(saleOf(r));
    sales.set(k, s);
    // Lots logged by hand were settled outside the app, so they never count as unpaid.
    if (r.saleId && r.payment !== 'paid') {
      const u = unpaid.get(k) ?? new Set();
      u.add(r.saleId);
      unpaid.set(k, u);
    }
    out.set(k, h);
  }
  for (const [k, h] of out) {
    h.sales = sales.get(k)?.size ?? 0;
    h.unpaidSales = unpaid.get(k)?.size ?? 0;
  }
  return out;
}

/** "3 sales, 7 lots, $105" with ", 1 sale left unpaid" when there is one. */
export function historyLine(h: BuyerHistory): string {
  const parts = [
    `${h.sales} ${h.sales === 1 ? 'sale' : 'sales'}`,
    `${h.lots} ${h.lots === 1 ? 'lot' : 'lots'}`,
    formatPrice(h.spent) || '$0',
  ];
  if (h.unpaidSales) parts.push(`${h.unpaidSales} ${h.unpaidSales === 1 ? 'sale' : 'sales'} left unpaid`);
  return parts.join(', ');
}
