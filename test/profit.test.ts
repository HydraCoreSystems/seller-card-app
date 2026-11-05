import { describe, expect, it } from 'vitest';
import { keptWords, profitPeriods, saleMoney } from '../src/core/profit';
import { DASH_PATTERN } from '../src/core/text';
import type { Plant, Sale, SaleRecord } from '../src/core/types';

const plant = (id: string, cost?: number | null): Plant => ({
  id, name: id, noid: false, price: 20, cost, kind: 'sale', photoUri: null, notes: '', sold: true, createdAt: '2026-10-01',
});
const sale = (over: Partial<Sale> = {}): Sale => ({
  id: 's1', formatId: 'generic', kind: 'sale', opens: null, closes: null, closeCall: '', claimRules: '', crossListing: '',
  lots: [
    { number: 1, plantId: 'a', name: 'A', noid: false, price: 20, description: '', photoUri: null },
    { number: 2, plantId: 'b', name: 'B', noid: false, price: 30, description: '', photoUri: null },
  ],
  createdAt: '2026-10-01', closedAt: '2026-10-10', shippingCharge: 8, ...over,
});
const rec = (lot: number, buyer: string, price: number, over: Partial<SaleRecord> = {}): SaleRecord => ({
  id: `r${lot}${buyer}`, saleId: 's1', lotNumber: lot, plantName: `P${lot}`, buyer, price, date: '2026-10-10', ...over,
});

describe('sale money', () => {
  it('adds claimed plants and shipping, takes costs off, and says when a cost is missing', () => {
    const m = saleMoney(sale(), [rec(1, 'Ann', 20), rec(2, 'Bo', 30)], [plant('a', 5), plant('b')]);
    expect(m.claimed).toBe(50);
    expect(m.shippingCharged).toBe(16);
    expect(m.takenIn).toBe(66);
    expect(m.costs).toBe(5);
    expect(m.kept).toBe(61);
    expect(m.missing).toBe(1);
    expect(m.complete).toBe(false);
    expect(keptWords(m)).toBe('Kept, before some costs');
  });

  it('charges shipping once per buyer, and a buyer own amount beats the flat one', () => {
    const s = sale({ fulfillment: { bo: { shippingCharge: 12 } } });
    const m = saleMoney(s, [rec(1, 'Ann', 20), rec(2, 'Ann', 30), rec(2, 'Bo', 30, { lotNumber: 2 })], [plant('a', 1), plant('b', 1)]);
    expect(m.shippingCharged).toBe(8 + 12);
  });

  it('leaves out never paid lots and counts waiting money', () => {
    const m = saleMoney(sale(), [rec(1, 'Ann', 20, { payment: 'paid' }), rec(2, 'Bo', 30, { payment: 'never' })], [plant('a', 4), plant('b', 4)]);
    expect(m.claimed).toBe(20);
    expect(m.waiting).toBe(0);
    expect(m.lots).toHaveLength(1);
    const w = saleMoney(sale(), [rec(1, 'Ann', 20), rec(2, 'Bo', 30, { payment: 'paid' })], [plant('a', 4), plant('b', 4)]);
    expect(w.waiting).toBe(20);
  });

  it('is complete once every plant has a cost and shipping cost is in when shipping was charged', () => {
    const records = [rec(1, 'Ann', 20), rec(2, 'Bo', 30)];
    const plants = [plant('a', 5), plant('b', 6)];
    expect(saleMoney(sale(), records, plants).complete).toBe(false);
    const done = saleMoney(sale({ shippingCost: 9, otherCosts: 3 }), records, plants);
    expect(done.complete).toBe(true);
    expect(done.costs).toBe(23);
    expect(done.kept).toBe(66 - 23);
    expect(keptWords(done)).toBe('Kept');
    expect(saleMoney(sale({ shippingCharge: null }), records, plants).shippingCharged).toBe(0);
  });

  it('says before costs when nothing was entered at all', () => {
    const m = saleMoney(sale(), [rec(1, 'Ann', 20)], [plant('a'), plant('b')]);
    expect(m.anyCost).toBe(false);
    expect(keptWords(m)).toBe('Kept, before costs');
    expect(m.kept).toBe(m.takenIn);
  });

  it('treats a deleted plant as a blank cost', () => {
    const m = saleMoney(sale(), [rec(1, 'Ann', 20)], []);
    expect(m.lots[0].cost).toBeNull();
    expect(m.missing).toBe(1);
  });
});

describe('profit by month', () => {
  it('rolls sales into the month they closed, with hand entered sales on their own day', () => {
    const sales = [sale(), sale({ id: 's2', closedAt: '2026-11-02' })];
    const records = [
      rec(1, 'Ann', 20),
      rec(2, 'Bo', 30),
      rec(1, 'Cy', 20, { saleId: 's2', id: 'x', date: '2026-11-02' }),
      { id: 'h', saleId: null, lotNumber: null, plantName: 'Fern', buyer: 'Di', price: 15, date: '2026-11-03' } as SaleRecord,
    ];
    const plants = [plant('a', 5), plant('b', 5)];
    const months = profitPeriods(records, sales, plants, 'month');
    expect(months.map((m) => m.key)).toEqual(['2026-11', '2026-10']);
    const nov = months[0];
    expect(nov.takenIn).toBe(20 + 8 + 15);
    expect(nov.costs).toBe(5);
    expect(nov.kept).toBe(38);
    expect(nov.complete).toBe(false);
    expect(months[1].takenIn).toBe(50 + 16);
    expect(months[1].sales).toBe(1);
  });

  it('keeps its words free of dashes', () => {
    for (const w of ['Kept', 'Kept, before some costs', 'Kept, before costs']) expect(DASH_PATTERN.test(w)).toBe(false);
  });
});

describe('profit words', () => {
  it('are free of dashes, and the paywall lists the profit point', async () => {
    const copy = await import('../src/core/profitCopy');
    const { PRO_POINTS } = await import('../src/core/pro');
    for (const t of Object.values(copy)) expect(DASH_PATTERN.test(t)).toBe(false);
    expect(PRO_POINTS).toContain(copy.PROFIT_POINT);
  });

  it('keep a plant cost through a backup', async () => {
    const { packBackup, unpackData, EMPTY_BACKUP_DATA } = await import('../src/core/backup');
    const data = { ...EMPTY_BACKUP_DATA, plants: [plant('a', 4.5)], sales: [sale({ shippingCost: 9, otherCosts: 2 })] };
    const back = unpackData(packBackup(data, { revision: 1, now: 0 }), '/x');
    expect(back.plants[0].cost).toBe(4.5);
    expect(back.sales[0].shippingCost).toBe(9);
    expect(back.sales[0].otherCosts).toBe(2);
  });
});
