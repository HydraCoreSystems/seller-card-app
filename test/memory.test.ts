/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buyerHistory, buyerKey, historyLine } from '../src/core/buyers';
import { trackClaims } from '../src/core/claims';
import { gatherLeftovers } from '../src/core/leftovers';
import { buildRundown, salesRecordHtml, unclaimedLots } from '../src/core/rundown';
import type { Lot, Profile, Sale, SaleRecord } from '../src/core/types';

const profile: Profile = {
  sellerName: 'Phil Achleman', sellerNumber: '', shipping: '$8 flat', shippingDays: [], payment: 'Venmo',
  timeZone: 'Eastern', claimRules: '', defaultFormat: 'generic',
};

function sale(id: string, day: string, lots: Lot[] = []): Sale {
  return {
    id, formatId: 'generic', kind: 'sale', opens: { day, time: '13:00' }, closes: null, closeCall: '',
    claimRules: '', crossListing: '', lots, createdAt: day,
  };
}

const lot = (number: number, name: string, plantId: string | null = null): Lot => ({
  number, plantId, name, noid: false, price: 15, description: 'Rooted', photoUri: null,
});

/** Closes a sale the way the rundown screen does: winners recorded, unclaimed lots kept. */
function close(s: Sale, report: ReturnType<typeof trackClaims> | null, records: SaleRecord[]) {
  const r = buildRundown({ sale: s, profile, report, records });
  const added: SaleRecord[] = r.lots
    .filter((l) => l.winner && !l.ruled)
    .map((l, i) => ({ id: `${s.id}${i}`, saleId: s.id, lotNumber: l.number, plantName: l.name, buyer: l.winner!, price: l.price, date: s.createdAt }));
  return { sale: { ...s, closedAt: s.createdAt, leftovers: unclaimedLots(r, s) }, records: [...records, ...added] };
}

const purgeThread = readFileSync(join(__dirname, 'fixtures/purge-2026-10-23.txt'), 'utf8');
const purge = close(sale('purge', '2026-10-23'), trackClaims(purgeThread), []);

// A week later: two lots, Jo Banks and a new buyer, plus the polyneura back for another go.
const second = close(
  sale('next', '2026-10-30', [lot(1, 'Hoya polyneura'), lot(2, 'Hoya Irina'), lot(3, 'Hoya carnosa')]),
  trackClaims('Phil\nAuthor\nLot 2\nLike\nJo Banks\nsold\nLike\nPhil\nAuthor\nLot 3\nLike\nNew Person\nsold\nLike', { maxLot: 3 }),
  purge.records,
);

describe('buyer memory', () => {
  it('builds each buyer’s history from the sales record alone', () => {
    const h = buyerHistory(second.records).get(buyerKey('Jo Banks'))!;
    expect(h).toMatchObject({ sales: 2, lots: 8, spent: 120, unpaidSales: 2 });
    expect(historyLine(h)).toBe('2 sales, 8 lots, $120, 2 sales left unpaid');
  });

  it('matches a buyer by the name they claim under, whatever the case or spacing', () => {
    expect(buyerKey('Jo Banks')).toBe(buyerKey('jo  banks'));
  });

  it('leaves the sale on screen out, and never counts a sale logged by hand as unpaid', () => {
    const hand: SaleRecord = { id: 'h', saleId: null, lotNumber: null, plantName: 'Hoya', buyer: 'Ana', price: 20, date: '2026-10-01' };
    const h = buyerHistory([...purge.records, hand], 'purge');
    expect([...h.keys()]).toEqual(['ana']);
    expect(h.get('ana')).toMatchObject({ sales: 1, lots: 1, spent: 20, unpaidSales: 0 });
  });

  it('stops counting a sale as unpaid once it’s marked paid, and leaves never paid lots out of what was spent', () => {
    const records = second.records.map((r) =>
      buyerKey(r.buyer) !== 'jobanks' ? r : r.saleId === 'purge' ? { ...r, payment: 'paid' as const } : { ...r, payment: 'never' as const },
    );
    const h = buyerHistory(records).get('jobanks')!;
    expect(h).toMatchObject({ sales: 2, lots: 8, spent: 105, unpaidSales: 1 });
  });

  it('flags repeat buyers in the rundown with their history from other sales', () => {
    const r = buildRundown({ sale: second.sale, profile, report: null, records: second.records });
    const jo = r.buyers.find((b) => b.name === 'Jo Banks')!;
    expect(jo.history).toMatchObject({ sales: 1, lots: 7 });
    expect(r.buyers.find((b) => b.name === 'New Person')!.history).toBeNull();
    expect(salesRecordHtml(r)).toContain('Repeat buyer');
  });

  it('reads a buyer as paid only when every lot they won is marked paid', () => {
    const records = second.records.map((r) => (r.saleId === 'next' && r.buyer === 'Jo Banks' ? { ...r, payment: 'paid' as const } : r));
    const r = buildRundown({ sale: second.sale, profile, report: null, records });
    expect(r.buyers.map((b) => [b.name, b.payment])).toEqual([
      ['Jo Banks', 'paid'],
      ['New Person', null],
    ]);
  });
});

describe('leftover relist', () => {
  it('gathers the unclaimed lots when a sale closes, in lot order', () => {
    const left = gatherLeftovers([purge.sale], purge.records, []);
    expect(left.map((l) => [l.lotNumber, l.lot.name, l.lot.price, l.why])).toEqual([
      [1, 'Hoya polyneura', 15, 'unclaimed'],
      [10, 'Hoya erythrostemma', 15, 'unclaimed'],
      [14, 'Hoya burmanica', 15, 'unclaimed'],
    ]);
  });

  it('keeps ties out, since someone still gets them', () => {
    const left = gatherLeftovers([purge.sale], purge.records, []);
    expect(left.map((l) => l.lotNumber)).not.toContain(11);
  });

  it('adds a lot when its winner never paid, and drops it again if the seller undoes that', () => {
    const never = purge.records.map((r) => (r.buyer === 'Max Dale' ? { ...r, payment: 'never' as const } : r));
    const left = gatherLeftovers([purge.sale], never, []);
    expect(left.filter((l) => l.why === 'unpaid').map((l) => l.lotNumber)).toEqual([6, 17]);
    expect(gatherLeftovers([purge.sale], purge.records, []).some((l) => l.why === 'unpaid')).toBe(false);
  });

  it('counts how many times a plant has been left over, across sales', () => {
    const left = gatherLeftovers([purge.sale, second.sale], second.records, []);
    const polyneura = left.filter((l) => l.lot.name === 'Hoya polyneura');
    expect(polyneura.map((l) => [l.saleId, l.times])).toEqual([
      ['purge', 1],
      ['next', 2],
    ]);
  });

  it('removes a leftover without touching the sales record, and keeps its count in the history', () => {
    const done = ['purge:1'];
    const left = gatherLeftovers([purge.sale, second.sale], second.records, done);
    expect(left.some((l) => l.key === 'purge:1')).toBe(false);
    expect(left.find((l) => l.key === 'next:1')!.times).toBe(2);
  });

  it('leaves out a sale that hasn’t closed yet', () => {
    expect(gatherLeftovers([{ ...second.sale, closedAt: undefined }], second.records, [])).toEqual([]);
  });
});
