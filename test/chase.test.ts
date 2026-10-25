/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flatShipping, reminderMessage } from '../src/core/chase';
import { trackClaims } from '../src/core/claims';
import { buildRundown } from '../src/core/rundown';
import { DASH_PATTERN } from '../src/core/text';
import type { Profile, Sale, SaleRecord } from '../src/core/types';

const profile: Profile = {
  sellerName: 'Phil Achleman', sellerNumber: '', shipping: '$8 flat', shippingDays: [], payment: 'Venmo @phil',
  timeZone: 'Eastern', claimRules: '', defaultFormat: 'generic', payWindowHours: 24,
};
const sale: Sale = {
  id: 'purge', formatId: 'generic', kind: 'sale', opens: { day: '2026-10-23', time: '13:00' }, closes: null,
  closeCall: '', claimRules: '', crossListing: '', lots: [], createdAt: '2026-10-23', closedAt: '2026-10-23',
};
const report = trackClaims(readFileSync(join(__dirname, 'fixtures/purge-2026-10-23.txt'), 'utf8'));
const r0 = buildRundown({ sale, profile, report, records: [] });
const records: SaleRecord[] = r0.lots
  .filter((l) => l.winner)
  .map((l) => ({ id: `r${l.number}`, saleId: 'purge', lotNumber: l.number, plantName: l.name, buyer: l.winner!, price: l.price, date: '2026-10-23' }));
const jo = r0.buyers.find((b) => b.name === 'Jo Banks')!;
const payBy = new Date(2026, 9, 24, 19, 0).getTime();

describe('flat shipping', () => {
  it('reads one plain amount and nothing else', () => {
    expect(flatShipping('$8 flat')).toBe(8);
    expect(flatShipping('USPS Priority $12.50 per box')).toBe(12.5);
    expect(flatShipping('$8 first plant, $2 each after')).toBeNull();
    expect(flatShipping('Free shipping')).toBeNull();
    expect(flatShipping('')).toBeNull();
  });
});

describe('the payment reminder', () => {
  it('lists the buyer’s lots, adds flat shipping, and fills in payment and the deadline', () => {
    const text = reminderMessage(jo, profile, r0.day, payBy);
    const lines = text.split('\n');
    expect(lines[0]).toBe('Hi Jo! A friendly reminder about your lots from my Grower Showcase on Friday, October 23.');
    expect(lines.filter((l) => l.startsWith('Lot '))).toHaveLength(7);
    expect(text).toContain('Plants: $105\nShipping: $8\nTotal: $113');
    expect(text).toContain('Payment: Venmo @phil\nPlease send it by Saturday, October 24 at 7:00 PM Eastern.\nThank you!');
  });

  it('carries shipping as written when it isn’t one flat amount', () => {
    const text = reminderMessage(jo, { ...profile, shipping: '$8 first plant, $2 each after' }, r0.day, null);
    expect(text).toContain('Plants: $105\nShipping: $8 first plant, $2 each after\n');
    expect(text).not.toContain('Total:');
    expect(text).not.toContain('Please send it by');
  });

  it('gives just the total with no shipping set', () => {
    expect(reminderMessage(jo, { ...profile, shipping: '' }, r0.day, null)).toContain('\nTotal: $105\n');
  });

  it('keeps dashes out', () => {
    for (const b of r0.buyers) expect(reminderMessage(b, profile, r0.day, payBy)).not.toMatch(DASH_PATTERN);
  });
});

describe('the chase list', () => {
  it('shrinks as buyers are marked paid', () => {
    const waiting = (recs: SaleRecord[]) => buildRundown({ sale, profile, report, records: recs }).buyers.filter((b) => !b.payment);
    const all = waiting(records).length;
    const joPaid = records.map((r) => (r.buyer === 'Jo Banks' ? { ...r, payment: 'paid' as const } : r));
    expect(waiting(joPaid).map((b) => b.name)).not.toContain('Jo Banks');
    expect(waiting(joPaid)).toHaveLength(all - 1);
  });
});
