import { describe, expect, it } from 'vitest';
import { announcementFor } from '../src/core/announce';
import { getFormat } from '../src/core/formats';
import { markerFor, markerShapes, stampFor } from '../src/core/marker';
import { numberLots } from '../src/core/sale';
import type { Shape } from '../src/core/seal';
import { DASH_PATTERN } from '../src/core/text';
import type { Plant, Profile, Sale, Venue } from '../src/core/types';
import { ROOM_PRESETS, applyRoomPreset, emptyVenue, legacyVenue, locationText, markerNumber, profileForVenue, resolveProfile, venuesOf, withVenues } from '../src/core/venues';

// These cover what the Phil test version adds, so they run in that build.
process.env.EXPO_PUBLIC_APP_VARIANT = 'phil';

const plant = (i: number): Plant => ({
  id: `p${i}`, name: `Hoya test ${i}`, noid: false, price: 10 + i, kind: 'sale', photoUri: null, notes: 'Rooted', sold: false, createdAt: '2026-11-01',
});

const commonsRoom: Venue = {
  ...emptyVenue('v-commons', 'The Commons', 'commons'),
  number: '001', business: 'also DBA Gathering Moss', shipping: 'USPS Priority, $12 flat', payment: 'PayPal Goods and Services', claimRules: 'First clear claim wins.', city: 'Fort Wayne', zip: '46802',
};
const marketRoom: Venue = {
  ...emptyVenue('v-market', 'Hoya Swap Market', 'generic'),
  number: '48', shipping: 'USPS Ground Advantage, $9 flat', payment: 'Venmo', claimRules: 'Pay within 24 hours.', city: 'Auburn', zip: '46706',
};
const quietRoom: Venue = { ...emptyVenue('v-quiet', 'Quiet Corner', 'generic'), shipping: '$7 flat', payment: 'Zelle' };

const base: Profile = {
  sellerName: 'Gathering Moss', sellerNumber: '', shipping: '', shippingDays: [], payment: '', timeZone: 'Eastern', claimRules: '', defaultFormat: 'generic',
};
const profile = withVenues(base, [commonsRoom, marketRoom, quietRoom], 'v-market');

const sale = (venueId: string | undefined, formatId: 'commons' | 'generic'): Sale => ({
  id: 's1', formatId, venueId, kind: 'sale', opens: { day: '2026-11-01', time: '19:00' }, closes: null, closeCall: '', claimRules: '', crossListing: '',
  lots: numberLots([plant(1), plant(2)]), createdAt: '2026-11-01',
});

describe('venues', () => {
  it('turns the single profile of an earlier build into one room', () => {
    const old: Profile = { ...base, sellerNumber: '12', shipping: '$8 flat', payment: 'Venmo', defaultFormat: 'generic' };
    const rooms = venuesOf(old);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ number: '12', shipping: '$8 flat', payment: 'Venmo', formatId: 'generic' });
    // A Commons seller's grower number comes across as the room's number.
    expect(legacyVenue({ ...old, defaultFormat: 'commons', growerNumber: '001' }).number).toBe('001');
  });

  it('keeps the room name as plain editable text, never the group long name', () => {
    expect(legacyVenue({ ...base, defaultFormat: 'commons' }).name).not.toMatch(/Hoya and Orchid/);
    const renamed = withVenues(base, [{ ...commonsRoom, name: 'Whatever The Room Is Called Now' }], 'v-commons');
    expect(resolveProfile(renamed, { venueId: 'v-commons' }).venueName).toBe('Whatever The Room Is Called Now');
  });

  it('mirrors the default room into the profile so older code keeps working', () => {
    expect(profile.shipping).toBe('USPS Ground Advantage, $9 flat');
    expect(profile.sellerNumber).toBe('48');
    expect(profile.defaultVenueId).toBe('v-market');
  });

  it('lays one room over the profile without touching the others', () => {
    const p = profileForVenue(profile, commonsRoom);
    expect(p).toMatchObject({ venueName: 'The Commons', defaultFormat: 'commons', growerNumber: '001', sellerNumber: '', city: 'Fort Wayne' });
    expect(resolveProfile(profile, { venueId: 'v-quiet' }).payment).toBe('Zelle');
    // A sale with no room, or a room that was deleted, uses the default room.
    expect(resolveProfile(profile, {}).venueName).toBe('Hoya Swap Market');
    expect(resolveProfile(profile, { venueId: 'gone' }).venueName).toBe('Hoya Swap Market');
  });
});

describe('cards and announcements draw from the sale\'s room', () => {
  it('prints each room\'s own shipping, payment, rules, number and location', () => {
    const a = announcementFor(profile, sale('v-market', 'generic'), false);
    expect(a).toContain('USPS Ground Advantage, $9 flat');
    expect(a).toContain('Payment: Venmo');
    expect(a).toContain('Seller: Gathering Moss (Seller #48)');
    expect(a).toContain('Location: Auburn 46706');
    expect(a).not.toMatch(/PayPal|\$12|Fort Wayne|001/);

    const c = announcementFor(profile, sale('v-commons', 'commons'), false);
    expect(c).toContain('Commons Verified Grower No. 001');
    expect(c).toContain('USPS Priority, $12 flat');
    expect(c).toContain('Location: Fort Wayne 46802');
    expect(c).not.toMatch(/Auburn|Venmo|Seller #48/);
  });

  it('leaves the location line off a room with no city or ZIP, and prints either alone', () => {
    expect(announcementFor(profile, sale('v-quiet', 'generic'), false)).not.toContain('Location');
    expect(locationText({ city: 'Fort Wayne', zip: '' })).toBe('Fort Wayne');
    expect(locationText({ city: '', zip: '46802' })).toBe('46802');
    expect(locationText({ city: ' ', zip: '' })).toBeNull();
  });

  it('prints the location line on a single plant card in both formats', () => {
    const lot = sale('v-market', 'generic').lots[0];
    for (const room of [commonsRoom, marketRoom]) {
      const p = profileForVenue(profile, room);
      const card = getFormat(room.formatId).single({ profile: p, sale: { kind: 'sale' }, lot, claimRules: 'x' });
      expect(card).toContain(`Location: ${room.city} ${room.zip}`);
    }
  });

  it('prints the sale note as its own paragraph, and nothing when it is blank', () => {
    const noted = announcementFor(profile, { ...sale('v-market', 'generic'), note: 'Thanks for stopping by!' }, false);
    expect(noted).toContain('Thanks for stopping by!');
    expect(announcementFor(profile, { ...sale('v-market', 'generic'), note: '   ' }, false)).toBe(announcementFor(profile, sale('v-market', 'generic'), false));
  });

  it('never puts a dash in what it prints', () => {
    for (const [v, f] of [['v-commons', 'commons'], ['v-market', 'generic']] as const) {
      expect(DASH_PATTERN.test(announcementFor(profile, { ...sale(v, f), note: 'Hello' }, true))).toBe(false);
    }
  });
});

describe('the circle marker', () => {
  const texts = (shapes: Shape[]) => shapes.flatMap((s) => (s.kind === 'text' ? [s.text] : []));

  it('appears under any room that has a number', () => {
    expect(markerNumber(profileForVenue(profile, marketRoom), 'generic')).toBe('48');
    expect(markerFor(profileForVenue(profile, marketRoom))).toEqual({ number: '48', style: 'venue', venueName: 'Hoya Swap Market' });
    expect(markerFor(profileForVenue(profile, commonsRoom))).toEqual({ number: '001', style: 'commons', venueName: 'The Commons' });
  });

  it('gives no circle to a room with no number, and the stamp names the room instead', () => {
    const quiet = profileForVenue(profile, quietRoom);
    expect(markerFor(quiet)).toBeNull();
    expect(stampFor(quiet, '2026-11-01').main).toBe('Gathering Moss  ·  Quiet Corner  ·  November 1, 2026');
    expect(markerFor(profileForVenue(profile, { ...commonsRoom, number: ' ' }))).toBeNull();
  });

  it('carries the room name and the number in a venue circle, with no Commons words', () => {
    const m = markerFor(profileForVenue(profile, marketRoom))!;
    const t = texts(markerShapes(m, 500, 500, 400));
    expect(t.join('')).toContain('HOYA SWAP MARKET');
    expect(t).toContain('No. 48');
    expect(t.join(' ')).not.toMatch(/COMMONS|VERIFIED|SELL WITH/);
    expect(markerShapes(m, 500, 500, 400).some((s) => s.kind === 'circle')).toBe(true);
  });

  it('keeps the other rooms’ ring lettering cream, since only the Commons seal went gold', () => {
    const m = markerFor(profileForVenue(profile, marketRoom))!;
    const ring = markerShapes(m, 500, 500, 400).filter((s) => s.kind === 'text' && s.text.length === 1 && s.text !== ' ');
    expect(ring.length).toBeGreaterThan(10);
    expect(ring.every((s) => s.kind === 'text' && s.color === '#F7F1E3')).toBe(true);
  });

  it('keeps the Commons seal art for the Commons wording', () => {
    const m = markerFor(profileForVenue(profile, commonsRoom))!;
    expect(texts(markerShapes(m, 500, 500, 400)).join('')).toContain('THE COMMONS');
  });

  it('keeps the existing stamp wording for a numbered room', () => {
    expect(stampFor(profileForVenue(profile, marketRoom), '2026-11-01').main).toBe('Gathering Moss  ·  Seller #48  ·  November 1, 2026');
    expect(stampFor(profileForVenue(profile, commonsRoom), '2026-11-01').main).toContain('Commons Verified Grower No. 001');
  });
});

describe('room presets', () => {
  let n = 0;
  const mint = () => `new-${++n}`;
  const find = (key: string) => ROOM_PRESETS.find((p) => p.key === key)!;

  it('puts US Hoya Market right after The Commons', () => {
    expect(ROOM_PRESETS.map((p) => p.name)).toEqual(['The Commons', 'US Hoya Market']);
  });

  it('makes the room once, with empty lines of its own, and selects it after that', () => {
    const first = applyRoomPreset([emptyVenue('a', 'My main room')], find('us-hoya-market'), mint);
    expect(first.venues).toHaveLength(2);
    const room = first.venues.find((v) => v.id === first.id)!;
    expect(room).toMatchObject({ name: 'US Hoya Market', formatId: 'generic', number: '', shipping: '', payment: '', claimRules: '' });
    const again = applyRoomPreset(first.venues, find('us-hoya-market'), mint);
    expect(again.venues).toHaveLength(2);
    expect(again.id).toBe(first.id);
  });

  it('finds a room by name however it is spaced or cased', () => {
    const have = [emptyVenue('a', '  us  HOYA market ')];
    const out = applyRoomPreset(have, find('us-hoya-market'), mint);
    expect(out.venues).toHaveLength(1);
    expect(out.id).toBe('a');
  });

  it('the Commons button finds a room already on Commons wording', () => {
    const have = [emptyVenue('a', 'My Commons room', 'commons')];
    expect(applyRoomPreset(have, find('commons'), mint).id).toBe('a');
    expect(applyRoomPreset([emptyVenue('b', 'Other')], find('commons'), mint).venues).toHaveLength(2);
  });
});
