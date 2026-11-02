import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { APP_NAME, SUGGESTIONS_URL, appName, originLine } from '../src/core/brand';
import { announcementFor } from '../src/core/announce';
import { FORM_TOKEN } from '../src/core/checkout';
import { COMMONS_NAME, commons } from '../src/core/formats/commons';
import { markerFor, stampFor } from '../src/core/marker';
import { numberLots } from '../src/core/sale';
import type { Plant, Profile, Sale } from '../src/core/types';
import { isPhil } from '../src/core/variant';
import { resolveDefault, resolveProfile, withVenues, emptyVenue } from '../src/core/venues';

const keep = process.env.EXPO_PUBLIC_APP_VARIANT;
afterEach(() => {
  if (keep === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
  else process.env.EXPO_PUBLIC_APP_VARIANT = keep;
});
const as = (v: 'phil' | undefined) => {
  if (v) process.env.EXPO_PUBLIC_APP_VARIANT = v;
  else delete process.env.EXPO_PUBLIC_APP_VARIANT;
};

const profile: Profile = {
  sellerName: 'Gathering Moss', timeZone: 'Eastern', sellerNumber: '12', growerNumber: '77', growerBusiness: 'Moss LLC', defaultFormat: 'commons',
  shipping: '$12 flat', shippingDays: ['Mon'], payment: 'Venmo', claimRules: 'First comment wins',
} as unknown as Profile;
const plant: Plant = { id: 'p1', name: 'Hoya carnosa', noid: false, price: 10, kind: 'sale', photoUri: null, notes: '', sold: false, createdAt: '2026-11-01' };
const sale = (): Sale => ({
  id: 's1', kind: 'sale', formatId: 'commons', opens: { day: '2026-11-02', time: '19:00' }, closes: { day: '2026-11-03', time: '20:00' },
  closeCall: '', claimRules: '', crossListing: '', createdAt: '2026-11-01', lots: numberLots([plant]), note: 'A note from me', contactHours: 24,
  endsAt: { day: '2026-11-03', time: '20:00' },
} as unknown as Sale);

describe('the two builds', () => {
  it('is the closed test build unless the Phil variant is set', () => {
    as(undefined);
    expect(isPhil()).toBe(false);
    as('phil');
    expect(isPhil()).toBe(true);
  });

  it('closed test: the profile is used as is, so there are no rooms', () => {
    as(undefined);
    const rooms = withVenues(profile, [emptyVenue('a', 'Room A'), emptyVenue('b', 'Room B')], 'b');
    expect(resolveProfile(rooms, { venueId: 'a' })).toBe(rooms);
    expect(resolveDefault(rooms)).toBe(rooms);
  });

  it('closed test: only a Commons grower number draws a circle, and the band reads as it always did', () => {
    as(undefined);
    expect(markerFor(profile)?.style).toBe('commons');
    expect(markerFor({ ...profile, defaultFormat: 'generic' })).toBeNull();
    const plain = { ...profile, defaultFormat: 'generic', sellerNumber: '12' } as Profile;
    expect(stampFor(plain, '2026-11-01').main).toBe('Gathering Moss  ·  Seller #12  ·  November 1, 2026');
    expect(stampFor({ ...plain, sellerNumber: '', venueName: 'Quiet Corner' } as Profile, '2026-11-01').main).toBe('Gathering Moss  ·  November 1, 2026');
  });

  it('production: names the Commons format in full, and the Phil build keeps its corrected label', () => {
    as(undefined);
    expect(commons.name).toBe('The Commons | Hoyas, Orchids and Other Rare Plants');
    expect(commons.name).toBe(COMMONS_NAME);
    as('phil');
    expect(commons.name).toBe('Commons sales card');
  });

  it('production: the note and the location line print when filled in, and stay absent when empty', () => {
    as(undefined);
    const withFields = { ...profile, city: 'Fort Wayne', state: 'IN', zip: '46802' } as Profile;
    const filled = announcementFor(withFields, sale(), false);
    expect(filled).toContain('A note from me');
    expect(filled).toContain('Location: Fort Wayne, IN 46802');
    expect(filled).not.toMatch(/within 24 hours/);
    const bare = announcementFor(profile, { ...sale(), note: undefined }, false);
    expect(bare).not.toContain('Location:');
    expect(bare).not.toContain('A note from me');
    // Pro adds only the buyer contact line.
    const paid = announcementFor(withFields, sale(), true);
    expect(paid).toMatch(/within 24 hours/);
    expect(paid.replace(/\n[^\n]*within 24 hours[^\n]*\n?/, '\n')).toContain('Location: Fort Wayne, IN 46802');
    as('phil');
    const phil = announcementFor({ ...profile, city: 'Fort Wayne', zip: '46802' } as Profile, sale(), true);
    expect(phil).toContain('A note from me');
    expect(phil).toContain('Fort Wayne');
    expect(phil).toMatch(/24 hours/);
  });
});

describe('the app name', () => {
  const productionLine = 'Made with Skrybix by Gathering Moss';
  const philLine = 'Made with Skrybix by Gathering Moss';

  it('is Skrybix, and cannot silently go back', () => {
    expect(APP_NAME).toBe('Skrybix');
  });

  it('production: says Skrybix on the origin line, the stamp and the announcement, and SprigList nowhere', () => {
    as(undefined);
    expect(appName()).toBe('Skrybix');
    expect(originLine()).toBe(productionLine);
    expect(stampFor(profile, '2026-11-01').origin).toBe(productionLine);
    const text = announcementFor(profile, sale(), false);
    expect(text).toContain(productionLine);
    expect(text).not.toMatch(/sprig/i);
  });

  it('Phil build: says Skrybix on the origin line, the stamp and the announcement, and SprigList nowhere', () => {
    as('phil');
    expect(appName()).toBe('Skrybix');
    expect(originLine()).toBe(philLine);
    expect(stampFor(profile, '2026-11-01').origin).toBe(philLine);
    const text = announcementFor(profile, sale(), true);
    expect(text).toContain(philLine);
    expect(text).not.toMatch(/sprig/i);
  });

  it('installs as Skrybix in production and as Skrybix Phil beside it in the Phil build', () => {
    const appConfig = createRequire(join(__dirname, 'variant.test.ts'))('../app.config.js') as (a: { config: Record<string, unknown> }) => Record<string, unknown>;
    const config = { name: 'Skrybix', slug: 'seller-card-app' };
    expect((JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8')) as { expo: { name: string } }).expo.name).toBe('Skrybix');
    as(undefined);
    expect(appConfig({ config })).toBe(config);
    as('phil');
    expect(appConfig({ config })).toMatchObject({ name: 'Skrybix Phil' });
  });

  it('production: writes the form word SKRYBSALE', () => {
    as(undefined);
    expect(FORM_TOKEN).toBe('SKRYBSALE');
  });

  it('leaves the suggestions link exactly as it is, since that form keeps its own title', () => {
    expect(SUGGESTIONS_URL).toBe('https://docs.google.com/forms/d/e/1FAIpQLSeqyTCBVGbXSpM6xs7R93fhsWX29JUXmnaTcKU3zAJbwRqD-A/viewform');
  });

  it('keeps the dead name out of the source, apart from the old form word that keeps working and comments', () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry.name)) {
          readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
            const code = line.trim();
            const comment = /^(\/\/|\/?\*)/.test(code);
            const kept = /LEGACY_FORM_TOKEN = 'SPRIGSALE'/.test(code);
            if (/sprig/i.test(code) && !comment && !kept) found.push(`${path}:${i + 1}`);
          });
        }
      }
    };
    walk(join(__dirname, '..', 'src'));
    expect(found).toEqual([]);
  });
});
