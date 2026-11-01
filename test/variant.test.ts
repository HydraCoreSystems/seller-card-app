import { afterEach, describe, expect, it } from 'vitest';
import { announcementFor } from '../src/core/announce';
import { commons } from '../src/core/formats/commons';
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

  it('closed test: keeps the Commons label it shipped with, and the Phil build corrects it', () => {
    as(undefined);
    expect(commons.name).toBe('Hoya and Orchid Commons');
    as('phil');
    expect(commons.name).toBe('Commons sales card');
  });

  it('closed test: the announcement carries no note, no deadline line and no location', () => {
    as(undefined);
    const text = announcementFor({ ...profile, city: 'Fort Wayne', zip: '46802' } as Profile, sale(), true);
    expect(text).not.toContain('A note from me');
    expect(text).not.toContain('Fort Wayne');
    expect(text).not.toMatch(/within 24 hours/);
    as('phil');
    const phil = announcementFor({ ...profile, city: 'Fort Wayne', zip: '46802' } as Profile, sale(), true);
    expect(phil).toContain('A note from me');
    expect(phil).toContain('Fort Wayne');
    expect(phil).toMatch(/24 hours/);
  });
});
