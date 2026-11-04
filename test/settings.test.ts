import { describe, expect, it } from 'vitest';
import { EMPTY_BACKUP_DATA, packBackup } from '../src/core/backup';
import { EXPORT_FILE_NAME, exportText, restoreText } from '../src/core/dataTools';
import { claimsWaiting, glanceFor, openSaleOf, paidThisMonth } from '../src/core/glance';
import { BAND_ALPHA, DEFAULT_SETTINGS, readSettings, stampKey, startingKind } from '../src/core/settings';
import { SETTINGS_COPY } from '../src/core/settingsCopy';
import { sealPlace } from '../src/core/seal';
import { stampLayout } from '../src/core/stamp';
import { DASH_PATTERN } from '../src/core/text';
import type { Plant, Profile, Sale, SaleRecord } from '../src/core/types';

const profile: Profile = { sellerName: 'Rowan', sellerNumber: '', shipping: 'USPS', shippingDays: [], payment: 'Venmo', timeZone: 'Central', claimRules: '', defaultFormat: 'generic' };
const plant = (extra: Partial<Plant> = {}): Plant => ({ id: 'p1', name: 'Hoya', noid: false, price: 10, kind: 'sale', photoUri: null, notes: '', sold: false, createdAt: '2026-11-01', ...extra });
const sale = (extra: Partial<Sale> = {}): Sale => ({
  id: 's1', formatId: 'generic', kind: 'sale', opens: null, closes: null, closeCall: '', claimRules: '', crossListing: '', createdAt: '2026-11-01',
  lots: [{ number: 1, plantId: 'p1', name: 'Hoya carnosa', noid: false, price: 20, description: '', photoUri: null }], ...extra,
});
const record = (extra: Partial<SaleRecord> = {}): SaleRecord => ({ id: 'r1', saleId: 's1', lotNumber: 1, plantName: 'Hoya', buyer: 'Jada Winslow', price: 20, date: '2026-11-02', ...extra });

describe('settings defaults and reading', () => {
  it('are exactly the behavior from before Settings existed', () => {
    expect(DEFAULT_SETTINGS.stamp).toEqual({ on: true, text: '', position: 'bottom', strength: 'medium' });
    expect(BAND_ALPHA.medium).toBe(0.55);
    expect(startingKind(DEFAULT_SETTINGS.card, true)).toBe('auction');
    expect(startingKind(DEFAULT_SETTINGS.card, false)).toBe('sale');
  });

  it('a chosen kind beats what the plants suggest', () => {
    expect(startingKind({ ...DEFAULT_SETTINGS.card, kind: 'sale' }, true)).toBe('sale');
    expect(startingKind({ ...DEFAULT_SETTINGS.card, kind: 'auction' }, false)).toBe('auction');
  });

  it('survives storage and ignores junk', () => {
    const s = { ...DEFAULT_SETTINGS, stamp: { on: false, text: 'My stamp', position: 'top' as const, strength: 'strong' as const }, card: { kind: 'auction' as const, note: 'Hi', crossListing: 'Etsy' } };
    expect(readSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(readSettings({ stamp: { position: 'sideways', strength: 9, on: 'yes' }, card: { kind: 'x' } })).toEqual(DEFAULT_SETTINGS);
    expect(readSettings({ stamp: { text: 'x'.repeat(500) } }).stamp.text).toHaveLength(80);
  });

  it('remakes a stamped copy when any part of the watermark changes', () => {
    const base = stampKey(DEFAULT_SETTINGS.stamp);
    for (const patch of [{ on: false }, { position: 'top' as const }, { strength: 'strong' as const }, { text: 'Mine' }]) {
      expect(stampKey({ ...DEFAULT_SETTINGS.stamp, ...patch })).not.toBe(base);
    }
  });
});

describe('watermark position', () => {
  it('keeps the band along the bottom unless asked, and moves it to the top', () => {
    const bottom = stampLayout(1000, 800);
    const top = stampLayout(1000, 800, 'top');
    expect(bottom.bandTop + bottom.bandHeight).toBe(800);
    expect(top.bandTop).toBe(0);
    expect(top.mainBaseline).toBeLessThan(top.bandHeight);
    expect(stampLayout(1000, 800, 'bottom')).toEqual(bottom);
  });

  it('puts the circle clear of the band either way', () => {
    const b = sealPlace(1000, 800);
    const t = sealPlace(1000, 800, 'top');
    expect(b.cy + b.diameter / 2).toBeLessThanOrEqual(stampLayout(1000, 800).bandTop);
    expect(t.cy - t.diameter / 2).toBeGreaterThanOrEqual(stampLayout(1000, 800, 'top').bandHeight);
  });
});

describe('home at a glance', () => {
  const now = new Date(2026, 10, 3);
  it('counts what is listed, waiting and paid', () => {
    const open = sale({ claimText: 'Most relevant\nJada Winslow\nLot 1: Hoya carnosa\nclaim\n2d' });
    const g = glanceFor({ profile, plants: [plant(), plant({ id: 'p2', sold: true })], sales: [open], records: [record({ saleId: 'other', payment: 'paid', paidDate: '2026-11-01' })], pro: false, now });
    expect(g.tiles.find((t) => t.id === 'listed')?.value).toBe('1');
    expect(g.tiles.find((t) => t.id === 'money')?.value).toBe('$20');
    expect(paidThisMonth([record({ payment: 'paid', paidDate: '2026-10-30' })], now)).toBe(0);
    expect(claimsWaiting(null, [], profile)).toBe(0);
    expect(claimsWaiting(sale(), [], profile)).toBe(0);
  });

  it('names the next thing to do, in order of need', () => {
    const g = (d: Partial<Parameters<typeof glanceFor>[0]>) => glanceFor({ profile, plants: [plant()], sales: [], records: [], pro: false, now, ...d });
    expect(g({ profile: null }).next?.route).toEqual({ to: 'setup' });
    expect(g({ plants: [] }).next?.route).toEqual({ to: 'plant' });
    expect(g({}).next?.route).toEqual({ to: 'pick' });
    expect(g({ sales: [sale()] }).next?.route).toMatchObject({ to: 'sale', screen: 'post' });
    expect(g({ sales: [sale({ postedAt: '2026-11-02' })] }).next?.route).toMatchObject({ screen: 'claims' });
    const closed = sale({ closedAt: '2026-11-02' });
    expect(g({ sales: [closed], records: [record()] }).next?.route).toMatchObject({ to: 'sale', screen: 'rundown' });
    expect(openSaleOf([closed])).toBeNull();
  });
});

describe('data tools', () => {
  const data = { ...EMPTY_BACKUP_DATA, profile, plants: [plant({ photoUri: 'file:///docs/photos/a.jpg' })] };

  it('exports one file in the backup format, and restores it', () => {
    const text = exportText(data, { now: 1, pro: true });
    expect(EXPORT_FILE_NAME.endsWith('.json')).toBe(true);
    expect(JSON.parse(text).app).toBe('skrybix');
    expect(JSON.parse(text).photos).toEqual(['a.jpg']);
    const out = restoreText(text, { dir: 'file:///new/photos', has: () => true });
    expect(out).toMatchObject({ ok: true, missingPhotos: 0 });
    if (out.ok) expect(out.data.plants[0].photoUri).toBe('file:///new/photos/a.jpg');
  });

  it('counts photos the phone does not have, and keeps the plants', () => {
    const out = restoreText(exportText(data, { now: 1, pro: false }), { dir: 'file:///new/photos', has: () => false });
    expect(out).toMatchObject({ ok: true, missingPhotos: 1 });
    if (out.ok) expect(out.data.plants[0].photoUri).toBeNull();
  });

  it('refuses a file that is not a Skrybix backup, or is from a newer one', () => {
    expect(restoreText('not json', { dir: '', has: () => true }).ok).toBe(false);
    expect(restoreText('{"app":"other","version":1}', { dir: '', has: () => true }).ok).toBe(false);
    const newer = JSON.stringify({ ...packBackup(EMPTY_BACKUP_DATA, { revision: 0, now: 1 }), version: 99 });
    expect(restoreText(newer, { dir: '', has: () => true }).ok).toBe(false);
  });
});

describe('Settings copy', () => {
  it('has no dashes of any kind', () => {
    const all = Object.values(SETTINGS_COPY).map((v) => (typeof v === 'function' ? v(3) : v));
    for (const t of all) expect(DASH_PATTERN.test(t), t).toBe(false);
    expect(all.length).toBeGreaterThan(60);
  });
});

import { TITLE_CAP_MS, TITLE_HOLD_MS, titleLiftAt } from '../src/core/title';

describe('title screen timing', () => {
  it('holds about two seconds when the app is ready at once', () => {
    expect(TITLE_HOLD_MS).toBe(2000);
    expect(titleLiftAt(0)).toBe(2000);
    expect(titleLiftAt(1500)).toBe(2000);
  });
  it('waits for a slow start, but never past three seconds', () => {
    expect(titleLiftAt(2600)).toBe(2600);
    expect(titleLiftAt(9000)).toBe(TITLE_CAP_MS);
    expect(titleLiftAt(null)).toBe(TITLE_CAP_MS);
    expect(TITLE_CAP_MS).toBeLessThanOrEqual(3000);
  });
});
