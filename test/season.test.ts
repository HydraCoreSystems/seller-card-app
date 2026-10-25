import { describe, expect, it } from 'vitest';
import { hasUncountedShipping, periodOf, seasonCsv, seasonTotals } from '../src/core/season';
import type { Sale, SaleRecord } from '../src/core/types';

const sale = (id: string, shippingCharge?: number | null): Sale => ({
  id, formatId: 'generic', kind: 'sale', opens: null, closes: null, closeCall: '', claimRules: '', crossListing: '',
  lots: [], createdAt: '2026-10-01', closedAt: '2026-10-01', ...(shippingCharge !== undefined ? { shippingCharge } : {}),
});
let n = 0;
const rec = (saleId: string | null, buyer: string, price: number, date: string, payment?: 'paid' | 'never'): SaleRecord => ({
  id: `r${n++}`, saleId, lotNumber: saleId ? n : null, plantName: 'Hoya', buyer, price, date, ...(payment ? { payment } : {}),
});

const sales = [sale('oct23', 8), sale('oct30', null), sale('sep', 10), sale('old')];
const records: SaleRecord[] = [
  // Oct 23, $8 flat: Jo paid two lots, Ava paid one, Cal still waiting, Oli never paid.
  rec('oct23', 'Jo Banks', 15, '2026-10-23', 'paid'),
  rec('oct23', 'jo banks', 20, '2026-10-23', 'paid'),
  rec('oct23', 'Ava Stone', 12, '2026-10-23', 'paid'),
  rec('oct23', 'Cal Moss', 30, '2026-10-23'),
  rec('oct23', 'Oli Ford', 40, '2026-10-23', 'never'),
  // Oct 30, tiered shipping: paid but shipping can't be counted.
  rec('oct30', 'Bea Lowry', 25, '2026-10-30', 'paid'),
  // A hand entry counts as taken, with no shipping.
  rec(null, 'Dee Park', 18, '2026-10-26'),
  // September, $10 flat.
  rec('sep', 'Jo Banks', 50, '2026-09-12', 'paid'),
  // Closed before shipping was kept on the showcase: falls back to the profile's flat amount.
  rec('old', 'Gus Reed', 5, '2025-06-01', 'paid'),
];

describe('periods', () => {
  it('starts weeks on Sunday and names months and seasons plainly', () => {
    expect(periodOf('2026-10-23', 'week')).toEqual({ key: '2026-10-18', label: 'Week of Sunday, October 18' });
    expect(periodOf('2026-10-18', 'week').key).toBe('2026-10-18');
    expect(periodOf('2026-11-01', 'week').key).toBe('2026-11-01');
    expect(periodOf('2026-10-23', 'month')).toEqual({ key: '2026-10', label: 'October 2026' });
    expect(periodOf('2026-10-23', 'season')).toEqual({ key: '2026', label: '2026 season' });
  });
});

describe('season totals', () => {
  it('adds up each month, newest first', () => {
    const months = seasonTotals(records, sales, 'month', 6);
    expect(months.map((m) => m.key)).toEqual(['2026-10', '2026-09', '2025-06']);
    // Plants: 4 kept on Oct 23 (Oli never paid), Bea, Dee. Gross: 15+20+12+25+18. Shipping: Jo once, Ava once.
    expect(months[0]).toMatchObject({ label: 'October 2026', plants: 6, gross: 90, shipping: 16, unpaid: 30 });
    expect(months[1]).toMatchObject({ plants: 1, gross: 50, shipping: 10, unpaid: 0 });
    expect(months[2]).toMatchObject({ shipping: 6 });
  });

  it('splits weeks and rolls up the season', () => {
    const weeks = seasonTotals(records, sales, 'week', null);
    expect(weeks.find((w) => w.key === '2026-10-18')).toMatchObject({ plants: 4, gross: 47, shipping: 16, unpaid: 30 });
    expect(weeks.find((w) => w.key === '2026-10-25')).toMatchObject({ plants: 2, gross: 43, shipping: 0 });
    expect(seasonTotals(records, sales, 'season', null)[0]).toMatchObject({ key: '2026', plants: 7, gross: 140, shipping: 26, unpaid: 30 });
  });

  it('says when tiered shipping went uncounted', () => {
    expect(hasUncountedShipping(records, sales)).toBe(true);
    expect(hasUncountedShipping(records.filter((r) => r.saleId !== 'oct30'), sales)).toBe(false);
  });
});

describe('the season file', () => {
  it('lists the season month by month with the total last', () => {
    expect(seasonCsv(records, sales, '2026', null)).toBe(
      [
        'Period,Plants sold,Gross taken,Shipping collected,Taken with shipping,Unpaid outstanding',
        'September 2026,1,50.00,10.00,60.00,0.00',
        'October 2026,6,90.00,16.00,106.00,30.00',
        '2026 total,7,140.00,26.00,166.00,30.00',
        '',
      ].join('\r\n'),
    );
  });

  it('gives a header and a zero total for a season with nothing in it', () => {
    expect(seasonCsv(records, sales, '2024', null).split('\r\n')[1]).toBe('2024 total,0,0.00,0.00,0.00,0.00');
  });
});
