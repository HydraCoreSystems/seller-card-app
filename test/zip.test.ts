import { describe, expect, it } from 'vitest';
import { getFormat } from '../src/core/formats';
import { numberLots } from '../src/core/sale';
import { DASH_PATTERN } from '../src/core/text';
import type { Plant, Profile, Venue } from '../src/core/types';
import { emptyVenue, locationText, profileForVenue, withVenues } from '../src/core/venues';
import { fillFromZip, lookupZip, zipDigits, type Place } from '../src/core/zip';
import { ZIP_DATA, ZIP_DATA_COUNT } from '../src/core/zipData';

// The location line is a Phil test version feature, so these run in that build.
process.env.EXPO_PUBLIC_APP_VARIANT = 'phil';

const fort: Place = { city: 'Fort Wayne', state: 'IN' };
const blank = { zip: '', city: '', state: '' };

/** What the profile form does on every ZIP keystroke: fill through fillFromZip and remember the fill. */
function form() {
  let fields = { ...blank };
  let fill: Place | null = null;
  return {
    get fields() {
      return fields;
    },
    typeZip(zip: string) {
      const next = fillFromZip(fields, zip, fill);
      fill = next.fill;
      fields = { zip, city: next.city, state: next.state };
    },
    typeCity(city: string) {
      fields = { ...fields, city };
    },
    typeState(state: string) {
      fields = { ...fields, state };
    },
  };
}

describe('the bundled ZIP lookup', () => {
  it('finds Fort Wayne, Indiana for 46804, Phil’s own ZIP', () => {
    expect(lookupZip('46804')).toEqual(fort);
    expect(lookupZip(' 46804 ')).toEqual(fort);
    expect(lookupZip('46804-1234')).toEqual(fort);
  });

  it('knows the other ZIPs a seller might type, leading zeros included', () => {
    expect(lookupZip('46706')).toEqual({ city: 'Auburn', state: 'IN' });
    expect(lookupZip('63101')).toEqual({ city: 'Saint Louis', state: 'MO' });
    expect(lookupZip('10001')).toEqual({ city: 'New York', state: 'NY' });
    expect(lookupZip('02108')).toEqual({ city: 'Boston', state: 'MA' });
    expect(lookupZip('00601')?.state).toBe('PR');
  });

  it('holds every ZIP the data says it holds, once each', () => {
    const lines = ZIP_DATA.split('\n');
    let seen = 0;
    for (const line of lines) {
      const [state, city, nums] = line.split('|');
      expect(state).toMatch(/^[A-Z]{2}$/);
      expect(city.length).toBeGreaterThan(0);
      seen += nums.split(',').length;
    }
    expect(seen).toBe(ZIP_DATA_COUNT);
    expect(ZIP_DATA_COUNT).toBeGreaterThan(33000);
  });

  it('fills nothing for a ZIP that is unfinished, not a ZIP, or not assigned', () => {
    for (const zip of ['', '4', '4680', '468044', 'abcde', '46 804', '4680a', '00000', '99999', '46804-12']) {
      expect(lookupZip(zip), zip).toBeNull();
    }
    expect(zipDigits('46804-1234')).toBe('46804');
    expect(zipDigits('46804-')).toBeNull();
  });
});

describe('the ZIP filling the city and state', () => {
  it('fills both from a fresh form the moment the ZIP is complete', () => {
    const f = form();
    f.typeZip('4');
    f.typeZip('468');
    f.typeZip('4680');
    expect(f.fields).toEqual({ zip: '4680', city: '', state: '' });
    f.typeZip('46804');
    expect(f.fields).toEqual({ zip: '46804', city: 'Fort Wayne', state: 'IN' });
  });

  it('refills while the city is still the app’s own fill, even through half typed ZIPs', () => {
    const f = form();
    f.typeZip('46804');
    f.typeZip('4680');
    expect(f.fields).toMatchObject({ city: 'Fort Wayne', state: 'IN' });
    f.typeZip('46706');
    expect(f.fields).toEqual({ zip: '46706', city: 'Auburn', state: 'IN' });
    f.typeZip('63101');
    expect(f.fields).toEqual({ zip: '63101', city: 'Saint Louis', state: 'MO' });
  });

  it('keeps the seller’s own city when the ZIP is retyped', () => {
    const f = form();
    f.typeZip('46804');
    f.typeCity('Ft. Wayne');
    f.typeZip('46802');
    expect(f.fields).toEqual({ zip: '46802', city: 'Ft. Wayne', state: 'IN' });
    f.typeZip('4680');
    f.typeZip('46706');
    expect(f.fields).toEqual({ zip: '46706', city: 'Ft. Wayne', state: 'IN' });
  });

  it('keeps a typed city on a form that was saved and reopened, and refills one that was never touched', () => {
    // No memory of what the app filled: the old ZIP's own city stands in for it.
    const untouched = fillFromZip({ zip: '46804', city: 'Fort Wayne', state: 'IN' }, '46706', null);
    expect(untouched).toMatchObject({ city: 'Auburn', state: 'IN' });
    const typed = fillFromZip({ zip: '46804', city: 'Ft. Wayne', state: 'IN' }, '46706', null);
    expect(typed).toMatchObject({ city: 'Ft. Wayne', state: 'IN' });
  });

  it('treats the city and the state on their own', () => {
    const f = form();
    f.typeZip('46804');
    f.typeState('OH');
    f.typeZip('46706');
    expect(f.fields).toEqual({ zip: '46706', city: 'Auburn', state: 'OH' });
    f.typeCity('');
    f.typeZip('46802');
    expect(f.fields).toEqual({ zip: '46802', city: 'Fort Wayne', state: 'OH' });
  });

  it('fills nothing and changes nothing for an unknown or incomplete ZIP', () => {
    const f = form();
    f.typeZip('46804');
    f.typeCity('Ft. Wayne');
    f.typeZip('99999');
    expect(f.fields).toEqual({ zip: '99999', city: 'Ft. Wayne', state: 'IN' });
    const empty = form();
    empty.typeZip('1234');
    empty.typeZip('abcde');
    empty.typeZip('00000');
    expect(empty.fields).toEqual({ zip: '00000', city: '', state: '' });
    expect(fillFromZip(blank, '4680', null)).toEqual({ city: '', state: '', fill: null });
  });
});

describe('the card printing the filled values', () => {
  const plant = (i: number): Plant => ({
    id: `p${i}`, name: `Hoya test ${i}`, noid: false, price: 10 + i, kind: 'sale', photoUri: null, notes: 'Rooted', sold: false, createdAt: '2026-11-01',
  });
  const base: Profile = {
    sellerName: 'Gathering Moss', sellerNumber: '', shipping: '', shippingDays: [], payment: '', timeZone: 'Eastern', claimRules: '', defaultFormat: 'generic',
  };
  const cardFor = (room: Venue) => {
    const profile = profileForVenue(withVenues(base, [room], room.id), room);
    const lot = numberLots([plant(1)])[0];
    return getFormat(room.formatId).single({ profile, sale: { kind: 'sale' }, lot, claimRules: 'x' });
  };

  it('prints the city, state and ZIP the ZIP filled in', () => {
    const f = form();
    f.typeZip('46804');
    const room: Venue = { ...emptyVenue('v1', 'Hoya Swap Market', 'generic'), ...f.fields };
    expect(cardFor(room)).toContain('Location: Fort Wayne, IN 46804');
  });

  it('prints the seller’s own city over the fill', () => {
    const f = form();
    f.typeZip('46804');
    f.typeCity('Ft. Wayne');
    const room: Venue = { ...emptyVenue('v1', 'Hoya Swap Market', 'generic'), ...f.fields };
    expect(cardFor(room)).toContain('Location: Ft. Wayne, IN 46804');
  });

  it('prints a room saved before states existed exactly as before', () => {
    const room: Venue = { ...emptyVenue('v1', 'Hoya Swap Market', 'generic'), city: 'Fort Wayne', zip: '46802' };
    delete (room as { state?: string }).state;
    expect(cardFor(room)).toContain('Location: Fort Wayne 46802');
  });

  it('leaves the line off with no city and no ZIP, even if a state is left behind', () => {
    const room: Venue = { ...emptyVenue('v1', 'Hoya Swap Market', 'generic'), state: 'IN' };
    expect(cardFor(room)).not.toContain('Location');
  });

  it('words the location line for each combination', () => {
    expect(locationText({ city: 'Fort Wayne', state: 'IN', zip: '46804' })).toBe('Fort Wayne, IN 46804');
    expect(locationText({ city: 'Fort Wayne', state: 'IN', zip: '' })).toBe('Fort Wayne, IN');
    expect(locationText({ city: '', state: 'IN', zip: '46804' })).toBe('IN 46804');
    expect(locationText({ city: '', state: 'IN', zip: '' })).toBeNull();
    expect(locationText({ city: 'Fort Wayne', zip: '46804' })).toBe('Fort Wayne 46804');
    for (const t of [locationText({ city: 'Fort Wayne', state: 'IN', zip: '46804' })!]) expect(t).not.toMatch(DASH_PATTERN);
  });
});
