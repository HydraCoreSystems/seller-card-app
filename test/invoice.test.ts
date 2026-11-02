import { describe, expect, it } from 'vitest';
import type { CheckoutRow } from '../src/core/checkout';
import { invoiceContent, invoiceFileName, invoiceHtml } from '../src/core/invoice';
import { INVOICE_POINT } from '../src/core/profitCopy';
import { PRO_POINTS } from '../src/core/pro';
import { DASH_PATTERN } from '../src/core/text';
import type { Profile } from '../src/core/types';

const room = {
  sellerName: 'Phil Moss', sellerNumber: '', shipping: '$8 flat', shippingDays: [], payment: 'PayPal: pay@example.com\nVenmo: @phil', timeZone: '',
  claimRules: '', defaultFormat: 'generic', city: 'Fort Wayne', state: 'IN', zip: '46802', venueName: 'Tuesday Room',
} as Profile;

const row = (over: Partial<CheckoutRow> = {}): CheckoutRow => ({
  buyer: 'Ann <B> Lee', key: 'ann', lots: [{ number: 1, name: 'Hoya kerrii', price: 20 }, { number: 3, name: 'Pothos', price: 15 }],
  plantsTotal: 35, shippingCharge: 8, shippingNote: null, totalOwed: 43, totalKnown: true, response: null, contacted: false, paid: false,
  neverPaid: false, shipped: false, packed: false, tracking: '', pickup: false, intendedMethod: '', paidVia: '', methodMismatch: false,
  stage: 'won', contactState: 'waiting', weightOz: null, ...over,
});

describe('invoice', () => {
  it('has the room, the buyer, the lots, shipping, the total and the payment lines', () => {
    const c = invoiceContent(row(), room, '2026-11-01');
    expect(c.heading).toBe('Tuesday Room');
    expect(c.sellerLines).toEqual(['Phil Moss', 'Fort Wayne, IN 46802']);
    expect(c.buyer).toBe('Ann <B> Lee');
    expect(c.lots).toEqual([{ text: 'Lot 1, Hoya kerrii', price: '$20' }, { text: 'Lot 3, Pothos', price: '$15' }]);
    expect(c.totals).toEqual([
      { label: 'Plants', value: '$35' },
      { label: 'Shipping', value: '$8' },
      { label: 'Total', value: '$43', strong: true },
    ]);
    expect(c.payLines).toEqual(['PayPal: pay@example.com', 'Venmo: @phil']);
  });

  it('handles pickup, unset tiered shipping and a paid buyer', () => {
    expect(invoiceContent(row({ pickup: true, shippingCharge: 0, totalOwed: 35 }), room, 'd').totals.map((t) => t.label)).toEqual(['Plants', 'Local pickup', 'Total']);
    const tiered = invoiceContent(row({ shippingCharge: null, totalKnown: false, shippingNote: 'By weight', totalOwed: 35 }), room, 'd');
    expect(tiered.totals).toEqual([{ label: 'Plants', value: '$35' }, { label: 'Shipping', value: 'By weight' }]);
    const paid = invoiceContent(row({ paid: true }), room, 'd');
    expect(paid.payLines).toEqual([]);
    expect(invoiceHtml(row({ paid: true }), room, '2026-11-01')).toContain('Paid. Thank you!');
  });

  it('escapes the buyer name, names the seller when there is no room name, and carries only the origin line', () => {
    const html = invoiceHtml(row(), room, '2026-11-01');
    expect(html).toContain('Ann &lt;B&gt; Lee');
    expect(html).not.toContain('<B>');
    expect(html).toContain('Made with ');
    expect(invoiceContent(row(), { ...room, venueName: undefined }, 'd').heading).toBe('Phil Moss');
    expect(html.match(/Skrybix/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('makes a safe file name and lists itself on the paywall', () => {
    expect(invoiceFileName('Ann <B> Lee', '2026-11-01')).toBe('Invoice_Ann_B_Lee_2026-11-01.pdf');
    expect(invoiceFileName('???', '2026-11-01')).toBe('Invoice_buyer_2026-11-01.pdf');
    expect(PRO_POINTS).toContain(INVOICE_POINT);
    expect(DASH_PATTERN.test(INVOICE_POINT)).toBe(false);
  });
});
