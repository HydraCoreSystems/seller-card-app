/**
 * Second Chance offers. When a winner hasn't paid inside the seller's window, or the seller
 * marks them never paid, the lot can go to the next buyer in line at the same price. The line
 * is the claim order the showcase closed with, as named in the Sales Record. If the runner up
 * passes or doesn't answer inside the window, the lot goes back to open with the leftovers.
 */
import { buyerKey } from './buyers';
import { joinLines, formatPrice, formatSaleTime, toDay } from './text';
import type { Profile, Sale, SaleRecord } from './types';

export interface SecondChance {
  lot: number;
  /** The winner who didn't pay. */
  from: string;
  /** The runner up it went to, or null when the seller sent the lot straight back to open. */
  to: string | null;
  /** When the offer went out, in milliseconds. */
  sentMs: number;
  outcome?: 'took' | 'passed';
}

export type OfferStatus = 'waiting' | 'took' | 'passed' | 'expired';

export const PAY_WINDOWS = [12, 24, 48] as const;
export const DEFAULT_PAY_WINDOW = 24;

export function windowMs(profile: Pick<Profile, 'payWindowHours'> | null): number {
  return (profile?.payWindowHours ?? DEFAULT_PAY_WINDOW) * 3_600_000;
}

export function offerStatus(o: SecondChance, window: number, now: number): OfferStatus {
  if (o.outcome) return o.outcome;
  if (o.to === null) return 'passed';
  return now >= o.sentMs + window ? 'expired' : 'waiting';
}

/** The first buyer in the closing claim order who hasn't already had this lot. */
export function runnerUp(sale: Sale, lot: number, records: SaleRecord[]): string | null {
  const had = new Set(records.filter((r) => r.saleId === sale.id && r.lotNumber === lot).map((r) => buyerKey(r.buyer)));
  for (const o of sale.offers ?? []) if (o.lot === lot && o.to) had.add(buyerKey(o.to));
  return (sale.claimOrder?.[lot] ?? []).find((name) => !had.has(buyerKey(name))) ?? null;
}

export interface ChanceCard {
  lot: number;
  name: string;
  price: number | null;
  /** The winner who hasn't paid. */
  buyer: string;
  runnerUp: string | null;
  /** overdue: still marked waiting past the window. never: marked never paid. offered: out to the runner up. */
  kind: 'overdue' | 'never' | 'offered';
  offer?: SecondChance;
  /** When the payment window, or the runner up's window, runs out. */
  dueMs: number;
}

/** Lots on a closed showcase that need a second chance call, in lot order. */
export function secondChances(sale: Sale, records: SaleRecord[], window: number, now: number): ChanceCard[] {
  if (!sale.closedMs) return [];
  const mine = records.filter((r) => r.saleId === sale.id && r.lotNumber !== null);
  const lots = [...new Set(mine.map((r) => r.lotNumber!))].sort((a, b) => a - b);
  const cards: ChanceCard[] = [];
  for (const lot of lots) {
    const recs = mine.filter((r) => r.lotNumber === lot);
    const offer = sale.offers?.find((o) => o.lot === lot);
    const first = recs[0];
    if (offer) {
      if (offerStatus(offer, window, now) === 'waiting') {
        cards.push({ lot, name: first.plantName, price: first.price, buyer: offer.from, runnerUp: offer.to, kind: 'offered', offer, dueMs: offer.sentMs + window });
      }
      continue;
    }
    const live = recs.find((r) => r.payment !== 'never');
    const due = sale.closedMs + window;
    if (live) {
      if (live.payment !== 'paid' && now >= due) {
        cards.push({ lot, name: live.plantName, price: live.price, buyer: live.buyer, runnerUp: runnerUp(sale, lot, records), kind: 'overdue', dueMs: due });
      }
      continue;
    }
    const runner = runnerUp(sale, lot, records);
    if (runner) cards.push({ lot, name: first.plantName, price: first.price, buyer: first.buyer, runnerUp: runner, kind: 'never', dueMs: due });
  }
  return cards;
}

/** True while a never paid lot is still waiting on the seller's second chance call. */
export function awaitingChance(sale: Sale, lot: number, records: SaleRecord[], window: number, now: number): boolean {
  const offer = sale.offers?.find((o) => o.lot === lot);
  if (offer) return offerStatus(offer, window, now) === 'waiting';
  return runnerUp(sale, lot, records) !== null;
}

/**
 * Takes the lot off the winner who didn't pay: their record turns never paid and the offer is
 * kept on the showcase. With no runner up, the lot goes straight back to open.
 */
export function applyOffer(
  sale: Sale,
  records: SaleRecord[],
  { lot, from, to, now }: { lot: number; from: string; to: string | null; now: number },
): { sale: Sale; records: SaleRecord[] } {
  const offer: SecondChance = to ? { lot, from, to, sentMs: now } : { lot, from, to: null, sentMs: now, outcome: 'passed' };
  const lost = (r: SaleRecord) => r.saleId === sale.id && r.lotNumber === lot && buyerKey(r.buyer) === buyerKey(from);
  return {
    sale: { ...sale, offers: [...(sale.offers ?? []).filter((o) => o.lot !== lot), offer] },
    records: records.map((r) => (lost(r) ? { ...r, payment: 'never' as const } : r)),
  };
}

/** The runner up took it, so a record goes in under their name; or they passed. */
export function applySettle(
  sale: Sale,
  records: SaleRecord[],
  { lot, outcome, id, date }: { lot: number; outcome: 'took' | 'passed'; id: string; date: string },
): { sale: Sale; records: SaleRecord[] } {
  const offer = sale.offers?.find((o) => o.lot === lot);
  if (!offer?.to) return { sale, records };
  const original = records.find((r) => r.saleId === sale.id && r.lotNumber === lot);
  const took: SaleRecord[] =
    outcome === 'took' && original
      ? [{ id, saleId: sale.id, lotNumber: lot, plantName: original.plantName, buyer: offer.to, price: original.price, date }]
      : [];
  return {
    sale: { ...sale, offers: sale.offers!.map((o) => (o.lot === lot ? { ...o, outcome } : o)) },
    records: [...took, ...records],
  };
}

/** The deadline as the seller's phone reads it, in the seller's own zone label. */
export function formatDeadline(ms: number, timeZone: string): string {
  const d = new Date(ms);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return formatSaleTime({ day: toDay(d), time }, timeZone);
}

/** The message the seller copies or sends to the runner up. */
export function offerMessage(card: Pick<ChanceCard, 'lot' | 'name' | 'price'>, to: string, profile: Profile, answerByMs: number): string {
  const first = to.trim().split(/\s+/)[0] || to;
  const price = card.price !== null ? ` at ${formatPrice(card.price)}` : '';
  return joinLines([
    `Hi ${first}! Lot ${card.lot}, ${card.name}, came back open and you were next in line. It’s yours${price} if you still want it.`,
    `Just let me know by ${formatDeadline(answerByMs, profile.timeZone)} and I’ll hold it for you.`,
    '',
    profile.shipping.trim() ? `Shipping: ${profile.shipping.trim()}` : null,
    profile.payment.trim() ? `Payment: ${profile.payment.trim()}` : null,
  ]);
}
