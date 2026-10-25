/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ORIGIN_LINE } from '../src/core/brand';
import { trackClaims } from '../src/core/claims';
import { buildRundown, salesRecordHtml } from '../src/core/rundown';
import { DASH_PATTERN } from '../src/core/text';
import type { Profile, Sale, SaleRecord } from '../src/core/types';

const profile: Profile = {
  sellerName: 'Phil Achleman',
  sellerNumber: '',
  shipping: '$8 flat',
  shippingDays: [1],
  payment: 'PayPal Friends and Family, Venmo',
  timeZone: 'Eastern',
  claimRules: '',
  defaultFormat: 'generic',
};

// The purge ran without the app, so the sale holds no lots; they come from the thread.
const sale: Sale = {
  id: 'purge',
  formatId: 'generic',
  kind: 'sale',
  opens: { day: '2026-10-23', time: '13:00' },
  closes: null,
  closeCall: '',
  claimRules: '',
  crossListing: '',
  lots: [],
  createdAt: '2026-10-23',
};

const thread = readFileSync(join(__dirname, 'fixtures/purge-2026-10-23.txt'), 'utf8');
const report = trackClaims(thread);

describe('the rundown of the October 23 purge', () => {
  const r = buildRundown({ sale, profile, report, records: [] });
  const lot = (n: number) => r.lots.find((l) => l.number === n)!;

  it('totals the sale: 17 of 20 claimed, two ties counted as claimed', () => {
    expect(r.lotsOffered).toBe(20);
    expect(r.lotsClaimed).toBe(17);
    expect(r.claimedValue).toBe(265);
    expect(r.shipping).toBe('$8 flat. Ships Mon.');
    expect(r.payment).toBe('PayPal Friends and Family, Venmo');
  });

  it('names winners by lot in posting order, with the plant name off the lot comment', () => {
    expect(r.lots.map((l) => l.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(lot(2)).toMatchObject({ name: 'Hoya sp. Gunung Gading', price: 15, winner: 'Ava Stone' });
    expect(lot(20)).toMatchObject({ name: 'Hoya callistophylla Emerald', price: 25 });
    expect([1, 10, 14].map((n) => lot(n).winner)).toEqual([null, null, null]);
  });

  it('names the whole line behind the winner on every contested lot', () => {
    expect(lot(2).line).toEqual(['Bea Lowry', 'Cal Moss', 'Dee Park']);
    expect(lot(3).line).toEqual(['Bea Lowry', 'Gus Reed', 'Dee Park', 'Hal Wren']);
    expect(lot(13).line).toEqual([]);
  });

  it('leaves the two same minute ties for the seller, with the line behind them', () => {
    expect(lot(11)).toMatchObject({ winner: null, tie: ['Ivy Cole', 'Jo Banks'], line: ['Gus Reed', 'Pam Hale', 'Dee Park', 'Sol Pike'] });
    expect(lot(20)).toMatchObject({ winner: null, tie: ['Tess Kerr', 'Wes Ortiz'], line: ['Dee Park', 'Xan Hu'] });
  });

  it('totals each buyer with their lots listed', () => {
    const jo = r.buyers.find((b) => b.name === 'Jo Banks')!;
    expect(jo.lots.map((l) => l.number)).toEqual([5, 8, 9, 12, 13, 16, 19]);
    expect(jo.total).toBe(105);
    expect(r.buyers.find((b) => b.name === 'Max Dale')!.total).toBe(30);
    expect(r.buyers.map((b) => b.name)).toEqual([
      'Ava Stone', 'Dee Park', 'Fay Long', 'Ivy Cole', 'Jo Banks', 'Max Dale', 'Oli Ford', 'Uma Price',
    ]);
  });

  it('flags open buyer questions in thread order, mentions taken off', () => {
    expect(r.questions.map((q) => [q.author, q.lot, q.text])).toEqual([
      ['Eve Hart', 2, 'any more?'],
      ['Kit Lane', 5, 'any more?'],
      ['Yuri Bell', null, 'Can you hold till the 28th?'],
      ['Lu Fenn', 6, 'more?'],
      ['Nia Gray', 6, 'any more of these?'],
      ['Oli Ford', 7, 'sold, if you have at least insulation! Maybe a heat pack?'],
      ['Uma Price', 14, 'ok. Throw it in!  Lol'],
    ]);
  });

  it('takes the seller’s ruling on a tie, keeping the other tied buyer first in line', () => {
    const records: SaleRecord[] = [
      { id: 'x', saleId: 'purge', lotNumber: 11, plantName: 'Hoya latifolia Snow Queen', buyer: 'Jo Banks', price: 15, date: '2026-10-23' },
    ];
    const ruled = buildRundown({ sale, profile, report, records });
    const l11 = ruled.lots.find((l) => l.number === 11)!;
    expect(l11).toMatchObject({ winner: 'Jo Banks', ruled: true, tie: null });
    expect(l11.line).toEqual(['Ivy Cole', 'Gus Reed', 'Pam Hale', 'Dee Park', 'Sol Pike']);
    expect(ruled.buyers.find((b) => b.name === 'Jo Banks')!.total).toBe(120);
  });
});

describe('a rundown before any thread is pasted', () => {
  it('lists the sale’s lots as unclaimed and takes winners from what the seller marked sold', () => {
    const withLots: Sale = {
      ...sale,
      lots: [1, 2].map((number) => ({ number, plantId: null, name: `Hoya ${number}`, noid: number === 2, price: 10, description: '', photoUri: null })),
    };
    const records: SaleRecord[] = [{ id: 'x', saleId: 'purge', lotNumber: 1, plantName: 'Hoya 1', buyer: 'Ana', price: 10, date: '2026-10-23' }];
    const r = buildRundown({ sale: withLots, profile, report: null, records });
    expect(r.lots.map((l) => [l.name, l.winner])).toEqual([
      ['Hoya 1', 'Ana'],
      ['Hoya 2 NOID (no confirmed name)', null],
    ]);
    expect(r.lotsClaimed).toBe(1);
    expect(r.questions).toEqual([]);
  });
});

describe('the Sales Record document', () => {
  const html = salesRecordHtml(buildRundown({ sale, profile, report, records: [] }));
  const words = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ');

  it('carries every section and the origin line', () => {
    for (const part of ['Sales Record, Phil Achleman', 'October 23, 2026', '17 of 20', '$265', 'Winners by lot', 'Next in line', 'Buyer totals', 'Open buyer questions', 'Can you hold till the 28th?']) {
      expect(words).toContain(part);
    }
    expect(words).toContain('Tie: Ivy Cole or Jo Banks. Your call.');
    expect(words).toContain(ORIGIN_LINE);
  });

  it('heads the record as a Grower Showcase, with the Commons Market heading only in the Commons format', () => {
    expect(words).toContain('Grower Showcase, October 23, 2026');
    expect(words).not.toContain('Commons');
    const commons = salesRecordHtml(buildRundown({ sale: { ...sale, formatId: 'commons' }, profile, report, records: [] }));
    expect(commons).toContain('Commons Market Sales Record, Phil Achleman');
  });

  it('keeps dashes out of the words a seller reads', () => {
    expect(words.replace(/<!doctype html>/i, '')).not.toMatch(DASH_PATTERN);
  });

  it('escapes what buyers typed', () => {
    const r = buildRundown({ sale, profile: { ...profile, sellerName: '<b>Phil</b>' }, report: null, records: [] });
    expect(salesRecordHtml(r)).toContain('&lt;b&gt;Phil&lt;/b&gt;');
  });
});
