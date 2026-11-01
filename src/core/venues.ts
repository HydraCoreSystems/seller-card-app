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

/** "Fort Wayne 46802", "Fort Wayne" or "46802". Null when the room has neither. */
export function locationText(profile: Pick<Profile, 'city' | 'zip'>): string | null {
  const text = [profile.city?.trim(), profile.zip?.trim()].filter(Boolean).join(' ');
  return text || null;
}
