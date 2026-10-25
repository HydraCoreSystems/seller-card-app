/**
 * Leftover relist. When a sale closes, its unclaimed lots and any lot whose winner never paid
 * gather into one list, ready to go up again in a new sale. The list is read from the closed
 * sales and the sales record; removing a leftover only hides it and never touches the record.
 */
import { buyerKey } from './buyers';
import { DEFAULT_PAY_WINDOW, awaitingChance } from './secondChance';
import type { Lot, Sale, SaleRecord } from './types';

export interface Leftover {
  /** saleId:lotNumber, stable across launches. */
  key: string;
  saleId: string;
  lotNumber: number;
  /** YYYY-MM-DD the sale closed. */
  closedAt: string;
  why: 'unclaimed' | 'unpaid';
  lot: Omit<Lot, 'number'>;
  /** How many times this plant has been left over, this time included. */
  times: number;
}

export const leftoverKey = (saleId: string, lotNumber: number) => `${saleId}:${lotNumber}`;

const plantOf = (lot: Omit<Lot, 'number'>) => lot.plantId ?? `name:${buyerKey(lot.name)}:${lot.noid ? 'noid' : ''}`;

const strip = (l: Lot): Omit<Lot, 'number'> => ({
  plantId: l.plantId, name: l.name, noid: l.noid, price: l.price, description: l.description, photoUri: l.photoUri,
});

/**
 * Every leftover still waiting, oldest sale first, with removed and relisted ones left out.
 * A never paid lot stays out while its second chance is still in play: someone is next in
 * line and the seller hasn't offered it yet, or the offer is still inside its window.
 */
export function gatherLeftovers(
  sales: Sale[],
  records: SaleRecord[],
  done: string[],
  { window = DEFAULT_PAY_WINDOW * 3_600_000, now = Date.now() }: { window?: number; now?: number } = {},
): Leftover[] {
  const all: Leftover[] = [];
  const closed = sales.filter((s) => s.closedAt).sort((a, b) => (a.closedAt! < b.closedAt! ? -1 : a.closedAt! > b.closedAt! ? 1 : 0));
  for (const sale of closed) {
    const recs = records.filter((r) => r.saleId === sale.id);
    const sold = (n: number) => recs.some((r) => r.lotNumber === n && r.payment !== 'never');
    const add = (lot: Lot, why: Leftover['why']) =>
      all.push({ key: leftoverKey(sale.id, lot.number), saleId: sale.id, lotNumber: lot.number, closedAt: sale.closedAt!, why, lot: strip(lot), times: 0 });

    for (const lot of sale.leftovers ?? []) if (!sold(lot.number)) add(lot, 'unclaimed');
    const never = [...new Set(recs.filter((r) => r.payment === 'never' && r.lotNumber !== null).map((r) => r.lotNumber!))];
    for (const n of never.sort((a, b) => a - b)) {
      if (sold(n) || all.some((l) => l.key === leftoverKey(sale.id, n))) continue;
      if (awaitingChance(sale, n, records, window, now)) continue;
      const r = recs.find((x) => x.lotNumber === n)!;
      const lot = sale.lots.find((l) => l.number === n) ?? {
        number: n, plantId: null, name: r.plantName, noid: false, price: r.price, description: '', photoUri: null,
      };
      add(lot, 'unpaid');
    }
  }
  const counts = new Map<string, number>();
  for (const l of all) {
    const p = plantOf(l.lot);
    counts.set(p, (counts.get(p) ?? 0) + 1);
    l.times = counts.get(p)!;
  }
  return all.filter((l) => !done.includes(l.key));
}
