import { describe, expect, it } from 'vitest';
import { lastSold, priceMemoryLine } from '../src/core/records';
import { DASH_PATTERN } from '../src/core/text';
import type { SaleRecord } from '../src/core/types';

let n = 0;
const rec = (plantName: string, price: number | null, date: string, extra: Partial<SaleRecord> = {}): SaleRecord => ({
  id: `r${n++}`, saleId: 'old', lotNumber: 1, plantName, buyer: 'Jo Banks', price, date, ...extra,
});

const records: SaleRecord[] = [
  rec('Hoya carnosa Krimson Queen', 20, '2026-09-12'),
  rec('Hoya Carnosa  Krimson Queen', 25, '2026-10-23'),
  rec('Hoya carnosa Krimson Queen', 40, '2026-10-24', { payment: 'never' }),
  rec('Hoya carnosa Krimson Queen', 99, '2026-10-30', { saleId: 'now' }),
  rec('Hoya NOID (no confirmed name)', 10, '2026-10-23'),
  rec('Monstera Thai Constellation', null, '2026-10-23'),
];

describe('price memory', () => {
  it('finds the latest price a plant name sold for, ignoring case and spacing', () => {
    expect(lastSold(records, 'hoya carnosa krimson queen', false, 'now')).toEqual({ price: 25, date: '2026-10-23' });
  });

  it('leaves out never paid lots and the showcase being built', () => {
    expect(lastSold(records, 'Hoya carnosa Krimson Queen', false)?.price).toBe(99);
    expect(lastSold(records, 'Hoya carnosa Krimson Queen', false, 'now')?.price).toBe(25);
  });

  it('has nothing for NOIDs, blank names, unsold names or sales without a price', () => {
    expect(lastSold(records, 'Hoya', true)).toBeNull();
    expect(lastSold(records, '', false)).toBeNull();
    expect(lastSold(records, 'Hoya kerrii', false)).toBeNull();
    expect(lastSold(records, 'Monstera Thai Constellation', false)).toBeNull();
  });

  it('reads as one quiet line with no dashes', () => {
    const line = priceMemoryLine({ price: 25, date: '2026-10-23' });
    expect(line).toBe('Last sold for $25 on October 23, 2026');
    expect(line).not.toMatch(DASH_PATTERN);
  });
});
