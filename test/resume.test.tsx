import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { draftFor, fullyShipped, moveTo, readResume, resumeName, resumeTarget, RESUME_COPY, screenName, trackPath, type Resume } from '../src/core/resume';
import { DASH_PATTERN } from '../src/core/text';
import type { Lot, Sale, SaleRecord } from '../src/core/types';

// The phone's storage, standing in for the SQLite file. Whatever one launch writes, the next launch reads.
const disk = new Map<string, string>();
vi.mock('expo-sqlite/kv-store', () => ({
  Storage: {
    getItemSync: (k: string) => disk.get(k) ?? null,
    setItemSync: (k: string, v: string) => void disk.set(k, v),
  },
}));

const lot = (number: number, name: string, price: number): Lot => ({ number, plantId: null, name, noid: false, price, description: '', photoUri: null });
const makeSale = (id: string, extra: Partial<Sale> = {}): Sale => ({
  id, formatId: 'generic', kind: 'sale', opens: null, closes: null, closeCall: '', claimRules: '', crossListing: '', createdAt: '2026-11-03',
  lots: [lot(1, 'Hoya carnosa', 25), lot(2, 'Hoya kerrii', 18)], ...extra,
}) as Sale;
const rec = (saleId: string, buyer: string, extra: Partial<SaleRecord> = {}): SaleRecord => ({ id: `${saleId}-${buyer}`, saleId, lotNumber: 1, plantName: 'Hoya', buyer, price: 10, date: '2026-11-03', ...extra });

const THREAD = 'Rowan\nAuthor\nLot 1: Hoya carnosa $25\n2d\nLike\nReply\nJada Winslow\nclaim\n3m\nLike\nReply';

beforeEach(() => disk.clear());

describe('which screens are remembered', () => {
  it('reads the sale and screen from the path, and the lot being worked on', () => {
    expect(trackPath('/sale/abc')).toEqual({ saleId: 'abc', path: '/sale/abc' });
    expect(trackPath('/sale/abc/claims')).toEqual({ saleId: 'abc', path: '/sale/abc/claims' });
    expect(trackPath('/sale/abc/post', { lot: '3' })).toEqual({ saleId: 'abc', path: '/sale/abc/post?lot=3' });
    expect(trackPath('/sale/abc/lot', { n: '2' })).toEqual({ saleId: 'abc', path: '/sale/abc/lot?n=2' });
    expect(trackPath('/sale/abc/lot', { n: 'x; drop' })?.path).toBe('/sale/abc/lot');
  });

  it('ignores everything that is not a screen inside a sale', () => {
    for (const p of ['/', '/profile', '/settings', '/sale/new', '/sale/abc/unknown', '/plant/1']) expect(trackPath(p)).toBeNull();
  });

  it('names the screen in plain words and uses no dashes', () => {
    expect(screenName('/sale/abc/claims')).toBe('claims');
    expect(screenName('/sale/abc')).toBe('the showcase');
    for (const t of [RESUME_COPY.title, RESUME_COPY.where('claims'), ...['', 'post', 'lot', 'claims', 'rundown', 'checkout', 'packing', 'money'].map((s) => screenName(`/sale/a/${s}`))]) {
      expect(DASH_PATTERN.test(t), t).toBe(false);
    }
    expect(resumeName(makeSale('a'))).toBe('Grower Showcase, 2 lots');
    expect(resumeName(makeSale('a', { name: 'Purge night' }))).toBe('Purge night');
  });
});

describe('who the resume target is', () => {
  const state: Resume = { version: 1, saleId: 'a', path: '/sale/a/claims', at: 1 };

  it('is the open sale and the screen the seller was on', () => {
    expect(resumeTarget(state, [makeSale('a')], [])).toMatchObject({ path: '/sale/a/claims', sale: { id: 'a' } });
  });

  it('is nothing on an install with no sale in progress', () => {
    expect(resumeTarget(null, [makeSale('a')], [])).toBeNull();
    expect(resumeTarget(state, [], [])).toBeNull();
    expect(readResume(null)).toBeNull();
    expect(readResume({ version: 2 })).toBeNull();
    expect(readResume({ version: 1, saleId: 'a', path: 'https://elsewhere' })).toBeNull();
  });

  it('stops when the seller closes the sale out', () => {
    expect(resumeTarget(state, [makeSale('a', { closedAt: '2026-11-03' })], [])).toBeNull();
  });

  it('stops when the sale is fully shipped, and not before', () => {
    const sale = makeSale('a', { fulfillment: { jadawinslow: { shipped: true }, marcusbell: { shipped: false } } });
    const records = [rec('a', 'Jada Winslow'), rec('a', 'Marcus Bell')];
    expect(fullyShipped(sale, records)).toBe(false);
    expect(resumeTarget(state, [sale], records)).not.toBeNull();
    const done = { ...sale, fulfillment: { jadawinslow: { shipped: true }, marcusbell: { shipped: true } } };
    expect(fullyShipped(done, records)).toBe(true);
    expect(resumeTarget(state, [done], records)).toBeNull();
    // A buyer who never paid does not hold the sale open.
    expect(fullyShipped(sale, [rec('a', 'Jada Winslow'), rec('a', 'Marcus Bell', { payment: 'never' })])).toBe(true);
  });

  it('moves to a different sale when the seller starts one, and drops the old lot draft', () => {
    const draft = { n: null, name: 'Half typed', noid: false, priceText: '12', description: '', photoUris: [] };
    const first = { ...moveTo(null, { saleId: 'a', path: '/sale/a/lot' }, 1), lotDraft: draft };
    expect(moveTo(first, { saleId: 'a', path: '/sale/a/claims' }, 2).lotDraft).toEqual(draft);
    const second = moveTo(first, { saleId: 'b', path: '/sale/b' }, 3);
    expect(second).toMatchObject({ saleId: 'b', path: '/sale/b', lotDraft: null });
    expect(resumeTarget(second, [makeSale('a'), makeSale('b')], [])!.sale.id).toBe('b');
  });

  it('hands a lot draft only to the form it belongs to', () => {
    const draft = { n: '2', name: 'Half typed', noid: false, priceText: '', description: '', photoUris: [] };
    const r: Resume = { ...state, lotDraft: draft };
    expect(draftFor(r, 'a', '2')).toEqual(draft);
    expect(draftFor(r, 'a', undefined)).toBeNull();
    expect(draftFor(r, 'b', '2')).toBeNull();
    expect(draftFor(null, 'a', '2')).toBeNull();
  });
});

/** One launch of the app: renders the real store from what is on the phone and reports what the seller would see. */
async function coldStart() {
  const { StoreProvider, useStore } = await import('../src/lib/store');
  let seen: unknown = null;
  function Probe() {
    const s = useStore();
    seen = { target: resumeTarget(s.resume, s.sales, s.records), sales: s.sales, plants: s.plants, resume: s.resume };
    return null;
  }
  renderToStaticMarkup(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );
  return seen as { target: { sale: Sale; path: string } | null; sales: Sale[]; plants: unknown[]; resume: Resume | null };
}

const write = (key: string, value: unknown) => disk.set(key, JSON.stringify(value));
const profile = { sellerName: 'Rowan', sellerNumber: '', shipping: 'USPS', shippingDays: [], payment: 'Venmo', timeZone: 'Central', claimRules: '', defaultFormat: 'generic' };

describe('a cold start in the middle of a sale', () => {
  it('lands the seller back in the sale with every claim, lot and note intact', async () => {
    // The seller was on the claims screen of a live sale when the app was cut off.
    const sale = makeSale('live', { note: 'Pickup Saturday, shipping Monday', claimText: THREAD });
    write('profile.v1', profile);
    write('sales.v1', [sale, makeSale('old', { closedAt: '2026-10-01' })]);
    write('resume.v1', moveTo(null, { saleId: 'live', path: '/sale/live/claims' }, 5));

    const launch = await coldStart();
    expect(launch.target?.path).toBe('/sale/live/claims');
    expect(launch.target?.sale).toEqual(sale);
    expect(launch.target?.sale.claimText).toBe(THREAD);
    expect(launch.target?.sale.note).toBe('Pickup Saturday, shipping Monday');
    expect(launch.target?.sale.lots.map((l) => l.name)).toEqual(['Hoya carnosa', 'Hoya kerrii']);
  });

  it('survives two cold starts in a row, because a launch only reads', async () => {
    write('profile.v1', profile);
    write('sales.v1', [makeSale('live', { claimText: THREAD })]);
    write('resume.v1', moveTo(null, { saleId: 'live', path: '/sale/live/post?lot=2' }, 5));
    expect((await coldStart()).target?.path).toBe('/sale/live/post?lot=2');
    expect((await coldStart()).target?.path).toBe('/sale/live/post?lot=2');
  });

  it('brings back a half typed lot and a pasted thread that was never read', async () => {
    const draft = { n: null, name: 'Hoya pubicalyx', noid: false, priceText: '30', description: 'Silver splash', photoUris: ['file:///photos/a.jpg'] };
    write('profile.v1', profile);
    write('sales.v1', [makeSale('live', { claimText: THREAD })]);
    write('resume.v1', { ...moveTo(null, { saleId: 'live', path: '/sale/live/lot' }, 5), lotDraft: draft });
    const launch = await coldStart();
    expect(draftFor(launch.resume, 'live', undefined)).toEqual(draft);
    expect(launch.target?.sale.claimText).toBe(THREAD);
  });

  it('behaves exactly as before when no sale is in progress', async () => {
    write('profile.v1', profile);
    write('sales.v1', [makeSale('old', { closedAt: '2026-10-01' })]);
    const none = await coldStart();
    expect(none.resume).toBeNull();
    expect(none.target).toBeNull();
    // A leftover target on a sale that has since closed also does nothing.
    write('resume.v1', moveTo(null, { saleId: 'old', path: '/sale/old/rundown' }, 5));
    expect((await coldStart()).target).toBeNull();
  });

  it('survives a damaged resume record without losing the sales', async () => {
    write('profile.v1', profile);
    write('sales.v1', [makeSale('live')]);
    disk.set('resume.v1', '{not json');
    const launch = await coldStart();
    expect(launch.target).toBeNull();
    expect(launch.sales).toHaveLength(1);
  });
});
