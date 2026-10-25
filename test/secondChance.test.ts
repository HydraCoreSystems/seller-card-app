/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { trackClaims } from '../src/core/claims';
import { gatherLeftovers } from '../src/core/leftovers';
import { buildRundown, claimOrderOf, salesRecordHtml, unclaimedLots } from '../src/core/rundown';
import { applyOffer, applySettle, offerMessage, runnerUp, secondChances, windowMs } from '../src/core/secondChance';
import { DASH_PATTERN } from '../src/core/text';
import type { Profile, Sale, SaleRecord } from '../src/core/types';

const profile: Profile = {
  sellerName: 'Phil Achleman', sellerNumber: '', shipping: '$8 flat', shippingDays: [], payment: 'Venmo @phil',
  timeZone: 'Eastern', claimRules: '', defaultFormat: 'generic', payWindowHours: 24,
};
const HOUR = 3_600_000;
const window = windowMs(profile);
const T = new Date(2026, 9, 23, 19, 0).getTime(); // closed at 7:00 PM on the night of the purge

const open: Sale = {
  id: 'purge', formatId: 'generic', kind: 'sale', opens: { day: '2026-10-23', time: '13:00' }, closes: null,
  closeCall: '', claimRules: '', crossListing: '', lots: [], createdAt: '2026-10-23',
};
const report = trackClaims(readFileSync(join(__dirname, 'fixtures/purge-2026-10-23.txt'), 'utf8'));

// Close the purge the way the rundown screen does, then mark everyone paid but Ava and Oli.
const r0 = buildRundown({ sale: open, profile, report, records: [] });
const sale: Sale = { ...open, closedAt: '2026-10-23', closedMs: T, leftovers: unclaimedLots(r0, open), claimOrder: claimOrderOf(r0) };
const records: SaleRecord[] = r0.lots
  .filter((l) => l.winner)
  .map((l) => ({
    id: `r${l.number}`, saleId: 'purge', lotNumber: l.number, plantName: l.name, buyer: l.winner!, price: l.price, date: '2026-10-23',
    payment: l.winner === 'Ava Stone' || l.winner === 'Oli Ford' ? undefined : ('paid' as const),
  }));

describe('the claim order the record keeps', () => {
  it('names the whole line on every lot, ties first where there is one', () => {
    expect(sale.claimOrder![2]).toEqual(['Ava Stone', 'Bea Lowry', 'Cal Moss', 'Dee Park']);
    expect(sale.claimOrder![11]).toEqual(['Ivy Cole', 'Jo Banks', 'Gus Reed', 'Pam Hale', 'Dee Park', 'Sol Pike']);
    expect(sale.claimOrder![1]).toBeUndefined();
  });

  it('picks the runner up as the first buyer in line who hasn’t had the lot', () => {
    expect(runnerUp(sale, 2, records)).toBe('Bea Lowry');
    expect(runnerUp(sale, 7, records)).toBeNull();
  });
});

describe('second chance offers', () => {
  it('waits out the payment window before offering anything', () => {
    expect(secondChances(sale, records, window, T + 23 * HOUR)).toEqual([]);
  });

  it('offers the overdue lots once the window closes, to the next in line', () => {
    const cards = secondChances(sale, records, window, T + 25 * HOUR);
    expect(cards.map((c) => [c.lot, c.kind, c.buyer, c.runnerUp])).toEqual([
      [2, 'overdue', 'Ava Stone', 'Bea Lowry'],
      [7, 'overdue', 'Oli Ford', null],
    ]);
  });

  it('offers a never paid lot right away, without waiting on the window', () => {
    const never = records.map((r) => (r.buyer === 'Ava Stone' ? { ...r, payment: 'never' as const } : r));
    expect(secondChances(sale, never, window, T + HOUR).map((c) => [c.lot, c.kind])).toEqual([[2, 'never']]);
  });

  it('holds a never paid lot out of the leftovers while someone is next in line', () => {
    const never = records.map((r) => (r.buyer === 'Ava Stone' ? { ...r, payment: 'never' as const } : r));
    const left = gatherLeftovers([sale], never, [], { window, now: T + HOUR });
    expect(left.map((l) => l.lotNumber)).toEqual([1, 10, 14]);
  });

  describe('once the offer goes to Bea', () => {
    const sentAt = T + 25 * HOUR;
    const offered = applyOffer(sale, records, { lot: 2, from: 'Ava Stone', to: 'Bea Lowry', now: sentAt });

    it('takes the lot off Ava and keeps it out of the leftovers while Bea decides', () => {
      expect(offered.records.find((r) => r.lotNumber === 2)!.payment).toBe('never');
      const cards = secondChances(offered.sale, offered.records, window, sentAt + HOUR);
      expect(cards.find((c) => c.lot === 2)).toMatchObject({ kind: 'offered', runnerUp: 'Bea Lowry', dueMs: sentAt + window });
      expect(gatherLeftovers([offered.sale], offered.records, [], { window, now: sentAt + HOUR }).some((l) => l.lotNumber === 2)).toBe(false);
    });

    it('makes the lot Bea’s when she takes it, at the same price, with the line moving up behind her', () => {
      const took = applySettle(offered.sale, offered.records, { lot: 2, outcome: 'took', id: 'b', date: '2026-10-24' });
      const r = buildRundown({ sale: took.sale, profile, report, records: took.records });
      expect(r.lots.find((l) => l.number === 2)).toMatchObject({
        winner: 'Bea Lowry', price: 15, payment: null, passedOver: ['Ava Stone'], line: ['Cal Moss', 'Dee Park'],
      });
      expect(r.buyers.find((b) => b.name === 'Ava Stone')).toBeUndefined();
      expect(salesRecordHtml(r)).toContain('Bea Lowry <span class="soft">(second chance after Ava Stone never paid)</span>');
      expect(secondChances(took.sale, took.records, window, sentAt + HOUR).some((c) => c.lot === 2)).toBe(false);
      expect(gatherLeftovers([took.sale], took.records, [], { window, now: sentAt + HOUR }).some((l) => l.lotNumber === 2)).toBe(false);
    });

    it('sends the lot back to open when Bea passes', () => {
      const passed = applySettle(offered.sale, offered.records, { lot: 2, outcome: 'passed', id: 'b', date: '2026-10-24' });
      const left = gatherLeftovers([passed.sale], passed.records, [], { window, now: sentAt + HOUR });
      expect(left.find((l) => l.lotNumber === 2)).toMatchObject({ why: 'unpaid', lot: { name: 'Hoya sp. Gunung Gading', price: 15 } });
    });

    it('sends the lot back to open when Bea’s window runs out with no answer', () => {
      const later = sentAt + window + 1;
      expect(secondChances(offered.sale, offered.records, window, later).some((c) => c.lot === 2)).toBe(false);
      expect(gatherLeftovers([offered.sale], offered.records, [], { window, now: later }).some((l) => l.lotNumber === 2)).toBe(true);
    });
  });

  it('sends a lot with nobody in line straight back to open', () => {
    const back = applyOffer(sale, records, { lot: 7, from: 'Oli Ford', to: null, now: T + 25 * HOUR });
    expect(secondChances(back.sale, back.records, window, T + 25 * HOUR)).toHaveLength(1);
    expect(gatherLeftovers([back.sale], back.records, [], { window, now: T + 25 * HOUR }).map((l) => l.lotNumber)).toContain(7);
  });

  it('leaves an open showcase alone', () => {
    expect(secondChances(open, records, window, T + 100 * HOUR)).toEqual([]);
  });
});

describe('the offer message', () => {
  const text = offerMessage({ lot: 2, name: 'Hoya sp. Gunung Gading', price: 15 }, 'Bea Lowry', profile, T + 49 * HOUR);

  it('greets the runner up and carries the lot, the price, the deadline, shipping and payment', () => {
    expect(text).toBe(
      [
        'Hi Bea! Lot 2, Hoya sp. Gunung Gading, came back open and you were next in line. It’s yours at $15 if you still want it.',
        'Just let me know by Sunday, October 25 at 8:00 PM Eastern and I’ll hold it for you.',
        '',
        'Shipping: $8 flat',
        'Payment: Venmo @phil',
      ].join('\n'),
    );
  });

  it('keeps dashes out', () => {
    expect(text).not.toMatch(DASH_PATTERN);
  });
});
