/**
 * Venues. A seller keeps one profile per room they sell in. A sale picks a room, and every
 * card, announcement, stamp, deadline line and form link for that sale draws from it.
 *
 * Code that already reads a Profile keeps working: resolveProfile lays one room's own lines
 * over the seller's profile and hands back a Profile of the same shape.
 */
import type { FormatId, Profile, Sale, Venue } from './types';
import { isPhil } from './variant';

export const DEFAULT_CONTACT_HOURS = 24;
export const CONTACT_HOURS = [12, 24, 36, 48] as const;

/** What a room is called when it came over from the single profile of an earlier build. */
const LEGACY_NAMES: Record<FormatId, string> = {
  commons: 'My Commons room',
  generic: 'My main room',
};

export function emptyVenue(id: string, name = '', formatId: FormatId = 'generic'): Venue {
  return {
    id,
    name,
    formatId,
    number: '',
    business: '',
    shipping: '',
    shippingDays: [],
    payment: '',
    claimRules: '',
    city: '',
    state: '',
    zip: '',
    contactHours: DEFAULT_CONTACT_HOURS,
    formLink: '',
    weightOz: null,
  };
}

/** The room an earlier, single profile stood for. */
export function legacyVenue(profile: Profile): Venue {
  const commons = profile.defaultFormat === 'commons';
  return {
    ...emptyVenue('venue-1', LEGACY_NAMES[profile.defaultFormat] ?? LEGACY_NAMES.generic, profile.defaultFormat),
    number: commons ? profile.growerNumber?.trim() || '' : profile.sellerNumber.trim(),
    business: profile.growerBusiness ?? '',
    shipping: profile.shipping,
    shippingDays: profile.shippingDays,
    payment: profile.payment,
    claimRules: profile.claimRules,
    city: profile.city ?? '',
    state: profile.state ?? '',
    zip: profile.zip ?? '',
    contactHours: profile.contactHours ?? DEFAULT_CONTACT_HOURS,
    formLink: profile.formLink ?? '',
    weightOz: profile.weightOz ?? null,
  };
}

/** The seller's rooms. A profile saved before rooms existed gets one made from its own lines. */
export function venuesOf(profile: Profile): Venue[] {
  return profile.venues?.length ? profile.venues : [legacyVenue(profile)];
}

export function defaultVenue(profile: Profile): Venue {
  const all = venuesOf(profile);
  return all.find((v) => v.id === profile.defaultVenueId) ?? all[0];
}

/** The room a sale runs in, or the default room for a sale made before rooms existed. */
export function venueOf(profile: Profile, sale: Pick<Sale, 'venueId'> | null | undefined): Venue {
  const all = venuesOf(profile);
  return all.find((v) => v.id === sale?.venueId) ?? defaultVenue(profile);
}

/** The profile as one room sees it: that room's number, lines and wording over the seller's own. */
export function profileForVenue(profile: Profile, venue: Venue): Profile {
  const commons = venue.formatId === 'commons';
  return {
    ...profile,
    defaultFormat: venue.formatId,
    sellerNumber: commons ? '' : venue.number.trim(),
    growerNumber: commons ? venue.number.trim() : '',
    growerBusiness: commons ? venue.business : '',
    shipping: venue.shipping,
    shippingDays: venue.shippingDays,
    payment: venue.payment,
    claimRules: venue.claimRules,
    venueId: venue.id,
    venueName: venue.name.trim(),
    city: venue.city.trim(),
    state: (venue.state ?? '').trim(),
    zip: venue.zip.trim(),
    contactHours: venue.contactHours,
    formLink: venue.formLink.trim(),
    weightOz: venue.weightOz,
  };
}

/** The profile a sale draws from: its room laid over the seller's profile. */
export function resolveProfile(profile: Profile, sale: Pick<Sale, 'venueId'> | null | undefined): Profile {
  // The closed test build has the one profile and no rooms, so a sale draws from it as it always did.
  if (!isPhil()) return profile;
  return profileForVenue(profile, venueOf(profile, sale));
}

/** The default room laid over the profile, for a plant posted on its own. */
export function resolveDefault(profile: Profile): Profile {
  if (!isPhil()) return profile;
  return profileForVenue(profile, defaultVenue(profile));
}

/**
 * Saves rooms onto a profile and mirrors the default room into the profile's own older fields,
 * so anything that still reads them sees the default room.
 */
export function withVenues(profile: Profile, venues: Venue[], defaultVenueId: string): Profile {
  const list = venues.length ? venues : [emptyVenue('venue-1', 'My main room')];
  const chosen = list.find((v) => v.id === defaultVenueId) ?? list[0];
  const mirrored = profileForVenue({ ...profile, venues: undefined }, chosen);
  return { ...profile, ...pickLegacy(mirrored), venues: list, defaultVenueId: chosen.id };
}

function pickLegacy(p: Profile): Partial<Profile> {
  return {
    defaultFormat: p.defaultFormat,
    sellerNumber: p.sellerNumber,
    growerNumber: p.growerNumber,
    growerBusiness: p.growerBusiness,
    shipping: p.shipping,
    shippingDays: p.shippingDays,
    payment: p.payment,
    claimRules: p.claimRules,
  };
}

/** The number a stamped photo's circle carries: the grower number in Commons wording, the room's number otherwise. */
export function markerNumber(profile: Profile, formatId: FormatId): string | null {
  const n = formatId === 'commons' ? profile.growerNumber : profile.sellerNumber;
  return n?.trim() || null;
}

/**
 * "Fort Wayne, IN 46802", "Fort Wayne 46802" (no state), "Fort Wayne" or "46802". Null when the room has neither
 * a city nor a ZIP. A state alone prints nothing, and with no city it leads the ZIP: "IN 46802".
 */
export function locationText(profile: Pick<Profile, 'city' | 'zip'> & { state?: string }): string | null {
  const city = profile.city?.trim() ?? '';
  const state = profile.state?.trim() ?? '';
  const zip = profile.zip?.trim() ?? '';
  if (!city && !zip) return null;
  const place = city && state ? `${city}, ${state}` : city;
  return [place, !city ? state : '', zip].filter(Boolean).join(' ');
}

/** A room Phil sells in often enough to earn a button. Tapping it makes the room, or finds the one he already has. */
export type RoomPreset = { key: string; name: string; formatId: FormatId };

export const ROOM_PRESETS: RoomPreset[] = [
  { key: 'commons', name: 'The Commons', formatId: 'commons' },
  { key: 'us-hoya-market', name: 'US Hoya Market', formatId: 'generic' },
];

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The room a preset button lands on. An existing room wins, so a button never makes a duplicate: the
 * Commons button also finds a room already set to Commons wording, and any preset finds its own name.
 * Otherwise a fresh room is added with the preset's name and wording, and every other line empty.
 */
export function applyRoomPreset(venues: Venue[], preset: RoomPreset, newId: () => string): { venues: Venue[]; id: string } {
  const found = venues.find((v) => norm(v.name) === norm(preset.name) || (preset.key === 'commons' && v.formatId === 'commons'));
  if (found) return { venues, id: found.id };
  const id = newId();
  return { venues: [...venues, emptyVenue(id, preset.name, preset.formatId)], id };
}
