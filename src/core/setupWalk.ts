/**
 * What the setup walk reads from and writes to the profile. The walk never keeps a second copy of
 * the seller's lines: each Next writes straight to the profile, in the room it is working on.
 */
import { numberLots } from './sale';
import type { FormatId, Plant, Profile, Sale, Venue } from './types';
import { applyRoomPreset, emptyVenue, venuesOf, withVenues, type RoomPreset } from './venues';

export interface WalkValues {
  roomName: string;
  formatId: FormatId;
  sellerName: string;
  number: string;
  zip: string;
  city: string;
  state: string;
  shipping: string;
  payment: string;
  formLink: string;
}

export const BLANK_VALUES: WalkValues = {
  roomName: '', formatId: 'generic', sellerName: '', number: '', zip: '', city: '', state: '', shipping: '', payment: '', formLink: '',
};

/** US time zone labels for the zone names a phone reports. Anything else is left for the seller to type in Profile. */
const ZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern', 'America/Detroit': 'Eastern', 'America/Indiana/Indianapolis': 'Eastern', 'America/Kentucky/Louisville': 'Eastern', 'America/Toronto': 'Eastern',
  'America/Chicago': 'Central', 'America/Menominee': 'Central', 'America/Indiana/Knox': 'Central', 'America/Winnipeg': 'Central',
  'America/Denver': 'Mountain', 'America/Boise': 'Mountain', 'America/Phoenix': 'Mountain', 'America/Edmonton': 'Mountain',
  'America/Los_Angeles': 'Pacific', 'America/Vancouver': 'Pacific',
  'America/Anchorage': 'Alaska', 'America/Juneau': 'Alaska',
  'Pacific/Honolulu': 'Hawaii',
};

export const zoneLabelFor = (iana: string | undefined): string => (iana ? ZONE_LABELS[iana] ?? '' : '');

/** The room the walk is working on, or null when the profile has none yet. */
export function walkVenue(profile: Profile | null, rooms: boolean, venueId?: string | null): Venue | null {
  if (!profile || !rooms || !profile.venues?.length) return null;
  return profile.venues.find((v) => v.id === venueId) ?? null;
}

/** What each field of the walk starts with: the profile's own lines, in the room being worked on. */
export function walkValues(profile: Profile | null, rooms: boolean, venueId?: string | null): WalkValues {
  if (!profile) return { ...BLANK_VALUES };
  const venue = walkVenue(profile, rooms, venueId);
  if (rooms && venueId && !venue) {
    // A room that is not made yet: the seller's name carries over, the room's own lines start blank.
    return { ...BLANK_VALUES, sellerName: profile.sellerName };
  }
  if (venue) {
    return {
      roomName: venue.name, formatId: venue.formatId, sellerName: profile.sellerName, number: venue.number,
      zip: venue.zip, city: venue.city, state: venue.state ?? '', shipping: venue.shipping, payment: venue.payment, formLink: venue.formLink,
    };
  }
  const commons = profile.defaultFormat === 'commons';
  return {
    roomName: '', formatId: profile.defaultFormat, sellerName: profile.sellerName,
    number: (commons ? profile.growerNumber : profile.sellerNumber)?.trim() ?? '',
    zip: profile.zip ?? '', city: profile.city ?? '', state: profile.state ?? '',
    shipping: profile.shipping, payment: profile.payment, formLink: profile.formLink ?? '',
  };
}

/**
 * The room a preset or a typed name lands on. In a build with rooms this finds the room already made or
 * adds one, never a duplicate. Returns the venues and the id to work in.
 */
export function chooseRoom(
  profile: Profile | null,
  pick: { preset: RoomPreset } | { name: string; formatId: FormatId },
  newId: () => string,
): { venues: Venue[]; id: string } {
  const have = profile?.venues ?? [];
  if ('preset' in pick) return applyRoomPreset(have, pick.preset, newId);
  return applyRoomPreset(have, { key: `typed-${pick.name.trim().toLowerCase()}`, name: pick.name.trim(), formatId: pick.formatId }, newId);
}

/**
 * Writes the walk's values into the profile. With rooms, into the chosen room (made if it is new),
 * with the profile mirroring the default room as it always does. Without rooms, into the profile itself.
 * A seller's own words are never replaced by an empty value they did not touch: the caller passes
 * what the screen holds, which starts from what the profile already says.
 */
export function applyWalk(
  base: Profile,
  values: WalkValues,
  o: { rooms: boolean; venueId?: string | null; newId: () => string; timeZone?: string },
): { profile: Profile; venueId: string | null } {
  const withZone: Profile = { ...base, sellerName: values.sellerName.trim(), timeZone: base.timeZone || o.timeZone || '' };
  if (!o.rooms) {
    const commons = values.formatId === 'commons';
    return {
      venueId: null,
      profile: {
        ...withZone,
        defaultFormat: values.formatId,
        sellerNumber: commons ? withZone.sellerNumber : values.number.trim(),
        growerNumber: commons ? values.number.trim() : withZone.growerNumber ?? '',
        zip: values.zip, city: values.city, state: values.state.trim().toUpperCase(),
        shipping: values.shipping, payment: values.payment, formLink: values.formLink.trim(),
      },
    };
  }
  const existing = base.venues?.length ? base.venues : [];
  let id = o.venueId && existing.some((v) => v.id === o.venueId) ? o.venueId : null;
  let list = existing;
  if (!id) {
    const made = chooseRoom(base, { name: values.roomName || 'My room', formatId: values.formatId }, o.newId);
    list = made.venues;
    id = made.id;
  }
  list = list.map((v) =>
    v.id === id
      ? {
          ...v,
          name: values.roomName.trim() || v.name,
          formatId: values.formatId,
          number: values.number.trim(),
          zip: values.zip, city: values.city, state: values.state.trim().toUpperCase(),
          shipping: values.shipping, payment: values.payment, formLink: values.formLink.trim(),
        }
      : v,
  );
  const defaultId = base.defaultVenueId && list.some((v) => v.id === base.defaultVenueId) ? base.defaultVenueId : list[0].id;
  return { venueId: id, profile: withVenues(withZone, list, defaultId) };
}

/** An example sale for the last screen, built from the seller's own lines so they see their card. */
export function previewSale(profile: Profile, venueId: string | null, formatId: FormatId, now = new Date()): Sale {
  const plant: Plant = { id: 'preview', name: 'Hoya carnosa', noid: false, price: 20, kind: 'sale', photoUri: null, notes: 'Rooted, ready to pot', sold: false, createdAt: '' };
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    id: 'preview', formatId, kind: 'sale', opens: { day, time: '19:00' }, closes: null, closeCall: '',
    claimRules: profile.claimRules, venueId: venueId ?? undefined, crossListing: '', lots: numberLots([plant]), createdAt: day,
  };
}

export { emptyVenue, venuesOf };
