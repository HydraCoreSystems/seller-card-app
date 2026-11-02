/**
 * What a seller kept. Three numbers everywhere: taken in, costs, kept.
 *
 * Taken in is the plant money from every lot a buyer kept, paid or still waiting, plus the shipping
 * the seller charged. A lot marked never paid is left out. Costs are only what the seller entered:
 * a cost per plant, what shipping cost for the sale, and one other costs amount for the sale. Kept is
 * taken in minus costs. Where a cost was left blank, the number says so ("before costs") instead of
 * pretending the blank was zero.
 *
 * A sale counts in the month it closed. A hand entered sale counts on its own day.
 */
import { buyerKey } from './buyers';
import { periodOf, type Span } from './season';
import type { Fulfillment, Plant, Sale, SaleRecord } from './types';

const cents = (n: number) => Math.round(n * 100) / 100;

export interface Money {
  takenIn: number;
  costs: number;
  kept: number;
  /** True when every cost that applies was entered, so kept is the real number. */
  complete: boolean;
  /** True when at least one cost was entered. */
  anyCost: boolean;
}

/** "Kept" when every cost is in, otherwise the plain way of saying it is not the whole story. */
export function keptWords(m: Pick<Money, 'complete' | 'anyCost'>): string {
  if (m.complete) return 'Kept';
  return m.anyCost ? 'Kept, before some costs' : 'Kept, before costs';
}

export interface LotMoney {
  number: number;
  name: string;
  buyer: string;
  price: number;
  plantId: string | null;
  cost: number | null;
  paid: boolean;
}

export interface SaleMoney extends Money {
  lots: LotMoney[];
  claimed: number;
  shippingCharged: number;
  /** Plant money from lots not yet marked paid. */
  waiting: number;
  plantCosts: number;
  shippingCost: number | null;
  otherCosts: number | null;
  /** How many lots have no cost entered. */
  missing: number;
}

const kept = (r: SaleRecord) => r.payment !== 'never';

/** The shipping charged to one buyer: their own amount when the seller entered one, else the sale's flat charge. */
function chargeFor(sale: Sale, fulfillment: Fulfillment | undefined): number {
  return fulfillment?.shippingCharge ?? sale.shippingCharge ?? 0;
}

/** Every number for one sale. */
export function saleMoney(sale: Sale, records: SaleRecord[], plants: Plant[]): SaleMoney {
  const mine = records.filter((r) => r.saleId === sale.id && kept(r));
  const lots: LotMoney[] = mine.map((r) => {
    const lot = sale.lots.find((l) => l.number === r.lotNumber);
    const plant = lot?.plantId ? plants.find((p) => p.id === lot.plantId) : undefined;
    return {
      number: r.lotNumber ?? 0,
      name: r.plantName,
      buyer: r.buyer,
      price: r.price ?? 0,
      plantId: plant?.id ?? null,
      cost: plant?.cost ?? null,
      paid: r.payment === 'paid',
    };
  });
  const claimed = cents(lots.reduce((n, l) => n + l.price, 0));
  const waiting = cents(lots.filter((l) => !l.paid).reduce((n, l) => n + l.price, 0));
  const buyers = new Set(mine.map((r) => buyerKey(r.buyer)));
  const shippingCharged = cents([...buyers].reduce((n, k) => n + chargeFor(sale, sale.fulfillment?.[k]), 0));
  const plantCosts = cents(lots.reduce((n, l) => n + (l.cost ?? 0), 0));
  const missing = lots.filter((l) => l.cost === null).length;
  const shippingCost = sale.shippingCost ?? null;
  const otherCosts = sale.otherCosts ?? null;
  const costs = cents(plantCosts + (shippingCost ?? 0) + (otherCosts ?? 0));
  const takenIn = cents(claimed + shippingCharged);
  return {
    lots,
    claimed,
    shippingCharged,
    waiting,
    plantCosts,
    shippingCost,
    otherCosts,
    missing,
    takenIn,
    costs,
    kept: cents(takenIn - costs),
    complete: missing === 0 && (shippingCharged === 0 || shippingCost !== null),
    anyCost: lots.some((l) => l.cost !== null) || shippingCost !== null || otherCosts !== null,
  };
}

export interface PeriodMoney extends Money {
  key: string;
  label: string;
  sales: number;
}

/** Money by week, month or season, newest first. Only periods with something taken in. */
export function profitPeriods(records: SaleRecord[], sales: Sale[], plants: Plant[], span: Span): PeriodMoney[] {
  const periods = new Map<string, PeriodMoney>();
  const at = (day: string) => {
    const p = periodOf(day, span);
    if (!periods.has(p.key)) periods.set(p.key, { ...p, sales: 0, takenIn: 0, costs: 0, kept: 0, complete: true, anyCost: false });
    return periods.get(p.key)!;
  };
  const add = (day: string, m: Money, count: number) => {
    const t = at(day);
    t.sales += count;
    t.takenIn += m.takenIn;
    t.costs += m.costs;
    t.complete = t.complete && m.complete;
    t.anyCost = t.anyCost || m.anyCost;
  };
  for (const sale of sales) {
    const m = saleMoney(sale, records, plants);
    if (!m.lots.length) continue;
    const day = sale.closedAt ?? records.find((r) => r.saleId === sale.id)?.date;
    if (day) add(day, m, 1);
  }
  // Sales entered by hand: no plant behind them, so no cost to find.
  for (const r of records) {
    if (r.saleId !== null || !kept(r)) continue;
    const price = r.price ?? 0;
    add(r.date, { takenIn: price, costs: 0, kept: price, complete: false, anyCost: false }, 1);
  }
  return [...periods.values()]
    .map((p) => ({ ...p, takenIn: cents(p.takenIn), costs: cents(p.costs), kept: cents(p.takenIn - p.costs) }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}
