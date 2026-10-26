import { describe, expect, it } from 'vitest';
import { getFormat } from '../src/core/formats';
import { growerNumber } from '../src/core/formats/commons';
import { BANNER_TITLE, bannerShapes, cardImage, sealPlace, sealShapes, wrapText, type Shape } from '../src/core/seal';
import { stampLayout } from '../src/core/stamp';
import type { Profile, Sale } from '../src/core/types';

const profile: Profile = {
  sellerName: 'Phil Achleman', sellerNumber: '12', shipping: '$8 flat', shippingDays: [], payment: 'Venmo',
  timeZone: 'Eastern', claimRules: '', defaultFormat: 'commons', growerNumber: '001', growerBusiness: 'also DBA Gathering Moss',
};
const texts = (shapes: Shape[]) => shapes.flatMap((s) => (s.kind === 'text' ? [s.text] : []));
// A rough stand in for a font: every letter half as wide as it is tall.
const measure = (s: string, size = 34) => s.length * size * 0.5;

describe('the grower number', () => {
  it('belongs to the Commons format alone', () => {
    expect(growerNumber(profile, 'commons')).toBe('001');
    expect(growerNumber(profile, 'generic')).toBeNull();
    expect(growerNumber({ ...profile, growerNumber: '  ' }, 'commons')).toBeNull();
    expect(growerNumber({ ...profile, growerNumber: undefined }, 'commons')).toBeNull();
  });

  it('keeps its text line on the card, and stays off generic cards', () => {
    const sale: Sale = {
      id: 's', formatId: 'commons', kind: 'sale', opens: null, closes: null, closeCall: '', claimRules: '', crossListing: '', createdAt: '2026-10-26', lots: [],
    };
    expect(getFormat('commons').announcement({ profile, sale })).toContain('Seller: Phil Achleman · Commons Verified Grower No. 001');
    expect(getFormat('generic').announcement({ profile, sale: { ...sale, formatId: 'generic' } })).not.toMatch(/Commons|001/);
    expect(getFormat('commons').announcement({ profile: { ...profile, growerNumber: '' }, sale })).toContain('Seller: Phil Achleman\n');
  });
});

describe('the seal', () => {
  const seal = sealShapes('001', 500, 500, 400);

  it('carries the room around the ring, the words Verified Grower, the number and the motto', () => {
    const t = texts(seal);
    expect(t.slice(0, 27).join('')).toBe('THE HOYA AND ORCHID COMMONS');
    expect(t.slice(27, 42).join('')).toBe('VERIFIED GROWER');
    expect(t).toContain('No. 001');
    expect(t).toContain('SELL WITH YOUR WORD ON FILE');
  });

  it('runs the top ring left to right over the top, and the bottom ring upright along the bottom', () => {
    const ring = seal.filter((s): s is Extract<Shape, { kind: 'text' }> => s.kind === 'text' && s.text.length === 1);
    const top = ring.slice(0, 27);
    const bottom = ring.slice(27, 42);
    expect(top[0].x).toBeLessThan(500);
    expect(top[26].x).toBeGreaterThan(500);
    expect(top[13].y).toBeLessThan(500);
    expect(top[13].rotate).toBeCloseTo(0);
    expect(bottom[0].x).toBeLessThan(bottom[14].x);
    expect(bottom.every((s) => s.y > 500)).toBe(true);
    expect(bottom[7].rotate).toBeCloseTo(0);
  });

  it('uses the standard palette and stays inside its circle', () => {
    const colors = new Set(seal.flatMap((s) => (s.kind === 'text' || s.kind === 'line' ? [s.color] : s.kind === 'poly' ? [s.fill] : [s.fill, s.stroke])).filter(Boolean));
    expect([...colors].sort()).toEqual(['#143629', '#1E4D3B', '#3E7C4F', '#C9A227', '#F7F1E3']);
    const outer = seal[0];
    expect(outer).toMatchObject({ kind: 'circle', r: 192 });
    for (const s of seal) {
      if (s.kind === 'poly') for (const [x, y] of s.points) expect(Math.hypot(x - 500, y - 500)).toBeLessThan(192);
    }
  });

  it('prints the number as the seller typed it', () => {
    expect(texts(sealShapes(' 17 ', 0, 0, 100))).toContain('No. 17');
  });
});

describe('the seal on a listing photo', () => {
  it('sits in the lower right, about a fifth of the width, inside the frame and above the stamp band', () => {
    for (const [w, h] of [[3024, 4032], [4032, 3024], [1080, 1080]]) {
      const at = sealPlace(w, h);
      expect(at.diameter).toBe(Math.round(w * 0.2));
      expect(at.cx + at.diameter / 2).toBeLessThan(w);
      expect(at.cx).toBeGreaterThan(w / 2);
      expect(at.cy + at.diameter / 2).toBeLessThanOrEqual(stampLayout(w, h).bandTop);
      expect(at.cy - at.diameter / 2).toBeGreaterThan(h / 2);
    }
  });
});

describe('the banner and the card image', () => {
  it('carries the title, number, name, vetted business name and the room', () => {
    const t = texts(bannerShapes({ number: '001', name: 'Phil Achleman', business: 'also DBA Gathering Moss' }, 0, 0, 2400));
    expect(t).toEqual(expect.arrayContaining([BANNER_TITLE, 'No. 001 · Phil Achleman', 'also DBA Gathering Moss', 'The Hoya and Orchid Commons']));
  });

  it('leaves the business line out when there is none', () => {
    const t = texts(bannerShapes({ number: '003', name: 'Tracy Poplinski', business: '' }, 0, 0, 2400));
    expect(t.filter((s) => s.length > 1 && !s.startsWith('No.') && s !== 'SELL WITH YOUR WORD ON FILE')).toEqual([
      BANNER_TITLE, 'The Hoya and Orchid Commons',
    ]);
  });

  it('puts the banner on top and every line of the card under it, wrapped to fit', () => {
    const text = 'Seller: Phil Achleman · Commons Verified Grower No. 001\n\nMade with Seller Card App by Gathering Moss';
    const card = cardImage(text, { number: '001', name: 'Phil Achleman', business: '' }, measure);
    const body = card.shapes.filter((s): s is Extract<Shape, { kind: 'text' }> => s.kind === 'text' && s.size === 34);
    expect(body.map((s) => s.text).join(' ')).toBe('Seller: Phil Achleman · Commons Verified Grower No. 001 Made with Seller Card App by Gathering Moss');
    expect(body.every((s) => measure(s.text) <= card.width - 112)).toBe(true);
    expect(Math.min(...body.map((s) => s.y))).toBeGreaterThan(56 + 968 * (760 / 2400));
    expect(Math.max(...body.map((s) => s.y))).toBeLessThan(card.height);
  });

  it('wraps words without losing any, and keeps blank lines', () => {
    expect(wrapText('one two three\n\nfour', 9, (s) => s.length)).toEqual(['one two', 'three', '', 'four']);
    expect(wrapText('Hoyacarnosakrimsonqueen', 5, (s) => s.length)).toEqual(['Hoyacarnosakrimsonqueen']);
  });
});
