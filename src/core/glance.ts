/**
 * The home screen at a glance: what is listed, what is waiting, what came in, and what the seller does next.
 * Everything here is read from the seller's own data. Nothing is stored.
 */
import { readClaims } from './claimReport';
import { checklistStages, currentStage } from './firstSale';
import type { Plant, Profile, Sale, SaleRecord } from './types';

export interface GlanceTile {
  id: 'listed' | 'claims' | 'money';
  label: string;
  value: string;
  /** One quiet line under the number. */
  note: string;
}

export type NextRoute =
  | { to: 'setup' }
  | { to: 'plant' }
  | { to: 'pick' }
  | { to: 'sale'; saleId: string; screen: '' | 'lot' | 'post' | 'claims' | 'checkout' | 'rundown' };

export interface Next {
  line: string;
  button: string;
  route: NextRoute;
}

export interface Glance {
  tiles: GlanceTile[];
  next: Next | null;
}

const dollars = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** The sale the seller is working on: the newest one that has not been closed. */
export function openSaleOf(sales: Sale[]): Sale | null {
  const open = sales.filter((s) => !s.closedAt);
  return open.length ? open.reduce((a, b) => (b.createdAt > a.createdAt ? b : a)) : null;
}

/** Lots with a claim that the seller has not marked sold yet, in the sale being worked on. */
export function claimsWaiting(sale: Sale | null, records: SaleRecord[], profile: Profile | null): number {
  if (!sale?.claimText?.trim()) return 0;
  const report = readClaims(sale.claimText, sale, profile);
  if (!report) return 0;
  return report.lots.filter((l) => l.queue.length > 0 && !records.some((r) => r.saleId === sale.id && r.lotNumber === l.lot)).length;
}

/** Money in for the month: what was marked paid, by the day it was marked. */
export function paidThisMonth(records: SaleRecord[], now: Date): number {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return records.filter((r) => r.payment === 'paid' && (r.paidDate ?? r.date).startsWith(month)).reduce((sum, r) => sum + (r.price ?? 0), 0);
}

export function glanceFor(d: { profile: Profile | null; plants: Plant[]; sales: Sale[]; records: SaleRecord[]; pro: boolean; now?: Date }): Glance {
  const now = d.now ?? new Date();
  const listed = d.plants.filter((p) => !p.sold).length;
  const open = openSaleOf(d.sales);
  const waiting = claimsWaiting(open, d.records, d.profile);
  const paid = paidThisMonth(d.records, now);
  const owing = d.records.filter((r) => !r.payment && r.saleId && d.sales.find((s) => s.id === r.saleId)?.closedAt).length;

  const tiles: GlanceTile[] = [
    { id: 'listed', label: 'Plants listed', value: String(listed), note: 'ready to sell' },
    { id: 'claims', label: 'Claims waiting', value: String(waiting), note: waiting ? 'to mark sold' : open ? 'none right now' : 'no sale open' },
    { id: 'money', label: 'Money in', value: dollars(paid), note: 'paid this month' },
  ];

  let next: Next | null = null;
  if (!d.profile) next = { line: 'A few lines and your first card builds itself.', button: 'Set up your profile', route: { to: 'setup' } };
  else if (!d.plants.length) next = { line: 'Add your first plant with a photo and a price.', button: 'Add a plant', route: { to: 'plant' } };
  else if (open) {
    const stage = currentStage(checklistStages(open, d.records, d.pro));
    const screens = { plants: 'lot', post: 'post', thread: 'claims', winners: 'claims', messages: 'checkout', close: 'rundown' } as const;
    if (waiting) next = { line: waiting === 1 ? 'One lot has a claim waiting to be marked sold.' : `${waiting} lots have claims waiting to be marked sold.`, button: 'Open the claims', route: { to: 'sale', saleId: open.id, screen: 'claims' } };
    else if (stage) {
      const lines = {
        plants: 'Finish your lots, each with a name and a price.',
        post: 'Your sale is built. Post it in your group.',
        thread: 'When the sale ends, paste the comments in.',
        winners: 'Check who won each lot and mark it sold.',
        messages: 'Message your winners and follow each one to paid.',
        close: 'Close the sale and save your sales record.',
      } as const;
      next = { line: lines[stage], button: 'Open the sale', route: { to: 'sale', saleId: open.id, screen: screens[stage] } };
    }
  } else if (owing) {
    const last = d.sales.filter((s) => s.closedAt).sort((a, b) => (a.closedAt! < b.closedAt! ? 1 : -1))[0];
    next = { line: owing === 1 ? 'One lot is still waiting on payment.' : `${owing} lots are still waiting on payment.`, button: 'Open the rundown', route: { to: 'sale', saleId: last.id, screen: 'rundown' } };
  } else if (listed) next = { line: 'Pick your plants and build your next sale.', button: 'Build a sale', route: { to: 'pick' } };
  return { tiles, next };
}
