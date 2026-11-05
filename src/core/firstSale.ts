/**
 * The first sale checklist. Every stage's done state is read from the sale's own data, so the card
 * can never disagree with the screens it points to. The one thing the app did not track before is
 * whether the seller got through the posting screen, so that screen stamps `postedAt` on the sale.
 */
import { buyerKey } from './buyers';
import type { GuideState } from './guide';
import type { Sale, SaleRecord } from './types';

export type StageId = 'plants' | 'post' | 'thread' | 'winners' | 'messages' | 'close';

export interface Stage {
  id: StageId;
  /** The screen this stage's button opens, under the sale. */
  to: 'lot' | 'post' | 'claims' | 'checkout' | 'rundown';
  /** What the seller does at this stage, in one plain sentence. */
  line: string;
  button: string;
  done: boolean;
}

/** The sale that counts as the seller's first: the oldest one still on the phone. */
export function firstSaleOf(sales: Sale[]): Sale | null {
  if (!sales.length) return null;
  return sales.reduce((a, b) => (b.createdAt < a.createdAt ? b : a));
}

const recordsOf = (sale: Sale, records: SaleRecord[]) => records.filter((r) => r.saleId === sale.id);

/** True once the sale is closed and, where the checkout chain runs, every winner's box has shipped. */
export function saleEnded(sale: Sale, records: SaleRecord[], pro: boolean): boolean {
  if (!sale.closedAt) return false;
  if (!pro) return true;
  const winners = recordsOf(sale, records).filter((r) => r.payment !== 'never');
  if (!winners.length) return true;
  const keys = new Set(winners.map((r) => buyerKey(r.buyer)));
  return [...keys].every((k) => sale.fulfillment?.[k]?.shipped);
}

/** The stages for this sale, in the order they light up. The winner message stage exists only with the checkout chain. */
export function checklistStages(sale: Sale, records: SaleRecord[], pro: boolean): Stage[] {
  const mine = recordsOf(sale, records);
  const lotsReady = sale.lots.length > 0 && sale.lots.every((l) => l.price !== null && l.name.trim() !== '');
  const thread = !!sale.claimText?.trim();
  const stages: Stage[] = [
    { id: 'plants', to: 'lot', line: 'Add your plants, each with a name and a price.', button: 'Add a lot', done: lotsReady },
    { id: 'post', to: 'post', line: 'Post the announcement, then each lot, in your Facebook group.', button: 'Post the sale', done: !!sale.postedAt || thread },
    { id: 'thread', to: 'claims', line: 'When the sale ends, copy the comments and paste them in.', button: 'Paste the thread', done: thread },
    { id: 'winners', to: 'claims', line: 'Check who won each lot and mark it sold.', button: 'Open the claims', done: mine.length > 0 },
  ];
  if (pro) {
    const marked = Object.keys(sale.fulfillment ?? {}).length > 0 || !!sale.checkout?.responses?.length || mine.some((r) => r.payment);
    stages.push({ id: 'messages', to: 'checkout', line: 'Message your winners, then follow each one to paid and shipped.', button: 'Open the rundown', done: marked });
  }
  stages.push({ id: 'close', to: 'rundown', line: 'Close the sale and save your sales record.', button: 'Open the rundown', done: !!sale.closedAt });
  return stages;
}

/** The checklist shows on the seller's first sale only, until they dismiss it or that sale reaches its end. */
export function showsChecklist(sale: Sale, sales: Sale[], records: SaleRecord[], guide: GuideState, pro: boolean): boolean {
  if (guide.checklistDismissed) return false;
  if (firstSaleOf(sales)?.id !== sale.id) return false;
  return !saleEnded(sale, records, pro);
}

/** The first stage not done yet: the one that is lit. */
export function currentStage(stages: Stage[]): StageId | null {
  return stages.find((s) => !s.done)?.id ?? null;
}
