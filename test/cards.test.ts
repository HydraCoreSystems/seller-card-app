import { describe, expect, it } from 'vitest';
import { ORIGIN_LINE } from '../src/core/brand';
import { COMMONS_NAME } from '../src/core/formats/commons';
import { FORMAT_LIST, getFormat } from '../src/core/formats';
import { numberLots, appendLot } from '../src/core/sale';
import { recordsToCsv, searchRecords } from '../src/core/records';
import { stampText, stampLayout } from '../src/core/stamp';
import { DASH_PATTERN, formatPrice, formatSaleTime, parseClock, parsePrice } from '../src/core/text';
import type { Plant, Profile, Sale } from '../src/core/types';

const profile: Profile = {
  sellerName: 'Gathering Moss',
  sellerNumber: '12',
  shipping: 'USPS Priority, $12 flat, ships Mondays',
  payment: 'PayPal Goods and Services, Venmo',
  timeZone: 'Central',
  claimRules: 'First clear claim wins. Pay within 24 hours.',
  defaultFormat: 'commons',
};

function plant(i: number, extra: Partial<Plant> = {}): Plant {
  return {
    id: `p${i}`,
    name: `Hoya test ${i}`,
    noid: false,
    price: 10 + i,
    kind: 'sale',
    photoUri: null,
    notes: 'Rooted, 4 leaves',
    sold: false,
    createdAt: '2026-10-24',
    ...extra,
  };
}

function sale(kind: 'sale' | 'auction', n = 3): Sale {
  return {
    id: 's1',
    formatId: 'generic',
    kind,
    opens: { day: '2026-10-25', time: '19:00' },
    closes: kind === 'auction' ? { day: '2026-10-26', time: '20:00' } : null,
    closeCall: 'by the clock on my phone',
    claimRules: profile.claimRules,
    crossListing: 'US Hoya Market',
    lots: numberLots(Array.from({ length: n }, (_, i) => plant(i + 1))),
    createdAt: '2026-10-24',
  };
}

describe('every format', () => {
  for (const format of FORMAT_LIST) {
    describe(format.name, () => {
      for (const kind of ['sale', 'auction'] as const) {
        const s = sale(kind);
        const outputs = {
          announcement: format.announcement({ profile, sale: s }),
          listing: format.listing({ profile, sale: s, lot: s.lots[0] }),
          single: format.single({ profile, sale: s, lot: s.lots[0], claimRules: profile.claimRules }),
        };
        for (const [layer, text] of Object.entries(outputs)) {
          it(`${kind} ${layer} ends with the origin line and has no dashes`, () => {
            expect(text.split('\n').at(-1)).toBe(ORIGIN_LINE);
            expect(text).not.toMatch(DASH_PATTERN);
          });
        }
        it(`${kind} listing stays lean: no shipping or payment terms`, () => {
          expect(outputs.listing).not.toContain('USPS');
          expect(outputs.listing).not.toContain('PayPal');
          expect(outputs.listing).toContain('Lot 1');
        });
        it(`${kind} announcement carries the sale terms once`, () => {
          expect(outputs.announcement).toContain(profile.shipping);
          expect(outputs.announcement).toContain(profile.payment);
          expect(outputs.announcement).toContain('Seller #12');
          expect(outputs.announcement).toContain('US Hoya Market');
          expect(outputs.announcement).toContain('Sunday, October 25 at 7:00 PM Central');
        });
      }
    });
  }

  it('auction announcements carry the close and listings carry the opening bid', () => {
    const f = getFormat('generic');
    const s = sale('auction');
    expect(f.announcement({ profile, sale: s })).toContain('Closes Monday, October 26 at 8:00 PM Central');
    expect(f.announcement({ profile, sale: s })).toContain('by the clock on my phone');
    expect(f.listing({ profile, sale: s, lot: s.lots[0] })).toContain('Opening bid $11');
  });

  it('names the Commons only inside the Commons format', () => {
    const s = sale('sale');
    expect(getFormat('commons').announcement({ profile, sale: s })).toContain(COMMONS_NAME);
    for (const text of [
      getFormat('generic').announcement({ profile, sale: s }),
      getFormat('generic').listing({ profile, sale: s, lot: s.lots[0] }),
      stampText('Gathering Moss', '12', '2026-10-24').origin,
    ]) {
      expect(text).not.toContain('Commons');
    }
  });

  it('states NOID plainly', () => {
    const s = sale('sale');
    const lot = { ...s.lots[0], name: 'Hoya', noid: true };
    expect(getFormat('generic').listing({ profile, sale: s, lot })).toContain('Hoya NOID (no confirmed name)');
  });
});

describe('purge mode', () => {
  it('numbers a twenty plant purge in one pass', () => {
    const s = sale('sale', 20);
    expect(s.lots.map((l) => l.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    const listings = s.lots.map((lot) => getFormat('commons').listing({ profile, sale: s, lot }));
    expect(listings).toHaveLength(20);
    expect(listings[19]).toContain('Lot 20');
    expect(listings.every((l) => l.endsWith(ORIGIN_LINE))).toBe(true);
  });

  it('keeps numbers fixed when a lot is added during the sale', () => {
    const s = sale('sale', 3);
    const removed = { ...s, lots: s.lots.filter((l) => l.number !== 2) };
    const added = appendLot(removed, { ...s.lots[0], plantId: null, name: 'Late add' });
    expect(added.lots.map((l) => l.number)).toEqual([1, 3, 4]);
  });
});

describe('text', () => {
  it('reads prices and clock times the way sellers type them', () => {
    expect(parsePrice('$25')).toBe(25);
    expect(parsePrice('1,200')).toBe(1200);
    expect(parsePrice('abc')).toBeNull();
    expect(formatPrice(12.5)).toBe('$12.50');
    expect(parseClock('8pm')).toBe('20:00');
    expect(parseClock('8:30 am')).toBe('08:30');
    expect(parseClock('8')).toBe('20:00');
    expect(parseClock('12am')).toBe('00:00');
    expect(formatSaleTime({ day: '2026-10-24', time: '09:05' }, '')).toBe('Saturday, October 24 at 9:05 AM');
  });
});

describe('sales record', () => {
  const records = [
    { id: 'a', saleId: 's1', lotNumber: 3, plantName: 'Hoya kerrii, splash', buyer: 'Tom "T" Okafor', price: 40, date: '2026-10-23' },
    { id: 'b', saleId: 's1', lotNumber: 1, plantName: 'Hoya carnosa', buyer: 'Jane Rivera', price: 25, date: '2026-10-24' },
  ];
  it('searches by plant, buyer or price, newest first', () => {
    expect(searchRecords(records, '').map((r) => r.id)).toEqual(['b', 'a']);
    expect(searchRecords(records, 'okafor').map((r) => r.id)).toEqual(['a']);
    expect(searchRecords(records, '$25').map((r) => r.id)).toEqual(['b']);
  });
  it('exports a simple spreadsheet file', () => {
    expect(recordsToCsv(records)).toBe(
      'Date,Plant,Buyer,Price,Lot\r\n' +
        '2026-10-24,Hoya carnosa,Jane Rivera,25.00,1\r\n' +
        '2026-10-23,"Hoya kerrii, splash","Tom ""T"" Okafor",40.00,3\r\n',
    );
  });
});

describe('photo stamp', () => {
  it('writes seller, number and date over the origin line', () => {
    expect(stampText('Gathering Moss', '12', '2026-10-24')).toEqual({
      main: 'Gathering Moss  ·  Seller #12  ·  October 24, 2026',
      origin: ORIGIN_LINE,
    });
    expect(stampText('Gathering Moss', '', '2026-10-24').main).not.toContain('Seller #');
  });
  it('keeps the band along the bottom edge and small', () => {
    for (const [w, h] of [[3000, 4000], [4000, 3000], [1080, 1080]]) {
      const l = stampLayout(w, h);
      expect(l.bandTop + l.bandHeight).toBe(h);
      expect(l.bandHeight / h).toBeLessThan(0.12);
      expect(l.originBaseline).toBeLessThan(h);
    }
  });
});
