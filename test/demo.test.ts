import { describe, expect, it } from 'vitest';
import { buyerHistory } from '../src/core/buyers';
import { gatherLeftovers } from '../src/core/leftovers';
import { lastSold } from '../src/core/records';
import { buildRundown } from '../src/core/rundown';
import { SAMPLE_SALE_ID, sampleData } from '../src/core/demo';
import { secondChances, windowMs } from '../src/core/secondChance';
import { seasonTotals } from '../src/core/season';
import { DASH_PATTERN } from '../src/core/text';
import { readClaims } from '../src/lib/claimReport';

const now = new Date(2026, 9, 26, 14, 0);
const d = sampleData(now);
const sale = d.sales[0];
const rundown = buildRundown({ sale, profile: d.profile, report: readClaims(sale.claimText, sale, d.profile), records: d.records });

describe('the sample showcase', () => {
  it('reads its own thread the way the claim tracker reads a real one', () => {
    expect(rundown.lots.map((l) => [l.number, l.winner, l.line])).toEqual([
      [1, 'Jada Winslow', ['Marcus Bell']],
      [2, 'Marcus Bell', []],
      [3, null, []],
      [4, null, []],
    ]);
    expect(rundown.questions.map((q) => [q.author, q.lot])).toEqual([['Priya Lund', 3]]);
  });

  it('has one lot paid, one waiting, and two leftovers', () => {
    expect(rundown.lots.map((l) => l.payment)).toEqual(['paid', null, null, null]);
    const left = gatherLeftovers(d.sales, d.records, d.leftoversDone, { window: windowMs(d.profile), now: now.getTime() });
    expect(left.map((l) => [l.lotNumber, l.why])).toEqual([[3, 'unclaimed'], [4, 'unclaimed']]);
    expect(secondChances(sale, d.records, windowMs(d.profile), now.getTime())).toEqual([]);
  });

  it('gives buyer memory, price memory and season totals something to say', () => {
    expect(buyerHistory(d.records, SAMPLE_SALE_ID).get('jadawinslow')).toBeTruthy();
    expect(d.buyerNotes).toHaveProperty('jadawinslow');
    const forSale = d.plants.find((p) => !p.sold && p.name === 'Hoya carnosa Krimson Queen')!;
    expect(lastSold(d.records, forSale.name, forSale.noid)).toEqual({ price: 25, date: '2026-10-26' });
    const month = seasonTotals(d.records, d.sales, 'month', null).find((p) => p.key === '2026-10')!;
    expect(month).toMatchObject({ plants: 2, gross: 25, shipping: 10, unpaid: 18 });
  });

  it('uses made up names only, and no dashes in anything a member reads', () => {
    const words = JSON.stringify([d.profile, d.plants.map((p) => [p.name, p.notes]), d.records.map((r) => [r.buyer, r.plantName]), d.buyerNotes, sale.claimText]);
    expect(words).not.toMatch(/Phil|Achleman|Gathering Moss|Commons/);
    for (const s of [d.profile.shipping, d.profile.payment, d.profile.claimRules, sale.claimText!, ...Object.values(d.buyerNotes), ...d.plants.map((p) => p.notes)]) {
      expect(s).not.toMatch(DASH_PATTERN);
    }
  });
});
