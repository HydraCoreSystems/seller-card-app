/**
 * The few changes that can be made to a seller's data away from the phone, as plain functions on the
 * data. The phone's store and the computer version both use them, so a change means the same on both.
 */
import type { BackupData } from './backup';
import { buyerKey } from './buyers';
import { markPayment } from './records';
import type { Fulfillment, Sale, SaleRecord } from './types';

/** The plants behind some of a sale's lots, so a record can find its plant. */
export function plantIdsFor(sale: Sale | undefined, lotNumbers: (number | null)[]): string[] {
  return lotNumbers.map((n) => sale?.lots.find((l) => l.number === n)?.plantId).filter((p): p is string => !!p);
}

/** Paid, never paid, or back to waiting, for every lot one buyer won in one sale. */
export function applyPayment(d: BackupData, saleId: string, buyer: string, payment: SaleRecord['payment'], today: string): BackupData {
  const k = buyerKey(buyer);
  const sale = d.sales.find((s) => s.id === saleId);
  // Lots already passed on to the next in line stay never paid whatever the buyer does now.
  const passedOn = (r: SaleRecord) => sale?.offers?.some((o) => o.lot === r.lotNumber && buyerKey(o.from) === k);
  const mine = (r: SaleRecord) => r.saleId === saleId && buyerKey(r.buyer) === k && !passedOn(r);
  // A buyer who never paid hands the plant back, so it shows as for sale again.
  const plantIds = new Set(plantIdsFor(sale, d.records.filter(mine).map((r) => r.lotNumber)));
  return {
    ...d,
    records: d.records.map((r) => (mine(r) ? markPayment(r, payment, today) : r)),
    plants: d.plants.map((p) => (plantIds.has(p.id) ? { ...p, sold: payment !== 'never' } : p)),
  };
}

/** Packing and shipping marks for one buyer in one sale. */
export function applyFulfillment(d: BackupData, saleId: string, key: string, patch: Partial<Fulfillment>): BackupData {
  return {
    ...d,
    sales: d.sales.map((s) =>
      s.id === saleId ? { ...s, fulfillment: { ...(s.fulfillment ?? {}), [key]: { ...(s.fulfillment?.[key] ?? {}), ...patch } } } : s,
    ),
  };
}

/** What a plant cost, or null to clear it. */
export function applyPlantCost(d: BackupData, plantId: string, cost: number | null): BackupData {
  return { ...d, plants: d.plants.map((p) => (p.id === plantId ? { ...p, cost } : p)) };
}

/** What shipping and anything else cost for one sale. */
export function applySaleCosts(d: BackupData, saleId: string, patch: { shippingCost?: number | null; otherCosts?: number | null }): BackupData {
  return { ...d, sales: d.sales.map((s) => (s.id === saleId ? { ...s, ...patch } : s)) };
}
