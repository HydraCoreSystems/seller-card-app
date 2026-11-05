/**
 * The circle on a stamped photo. Any room that issues the seller a number gets one: the Commons
 * wording keeps its own seal art, every other room gets the same circle carrying the room's name.
 * A room with no number gets no circle, and its stamp carries the room's name in the band instead.
 */
import { sealShapes, venueSealShapes, type Shape } from './seal';
import { stampText, type StampText } from './stamp';
import { markerNumber } from './venues';
import type { FormatId, Profile } from './types';
import { isPhil } from './variant';

export interface Marker {
  number: string;
  /** commons: the Commons Verified Grower seal. venue: the plain circle with the room's name. */
  style: 'commons' | 'venue';
  venueName: string;
}

/** The marker for a profile resolved to one room, or null when the room has no number. */
export function markerFor(profile: Profile, formatId: FormatId = profile.defaultFormat): Marker | null {
  // The closed test build draws the Commons seal for a grower number and nothing else.
  const number = isPhil() ? markerNumber(profile, formatId) : formatId === 'commons' ? profile.growerNumber?.trim() || null : null;
  if (!number) return null;
  return { number, style: formatId === 'commons' ? 'commons' : 'venue', venueName: profile.venueName ?? '' };
}

/** The band text for a profile resolved to one room. */
export function stampFor(profile: Profile, day: string, formatId: FormatId = profile.defaultFormat): StampText {
  const marker = markerFor(profile, formatId);
  if (!isPhil()) return stampText(profile.sellerName, profile.sellerNumber, day, marker?.number ?? null);
  return stampText(
    profile.sellerName,
    formatId === 'commons' ? '' : profile.sellerNumber,
    day,
    marker?.style === 'commons' ? marker.number : null,
    profile.venueName ?? '',
  );
}

/** The circle's shapes for a marker, in the room's own art. */
export function markerShapes(marker: Marker, cx: number, cy: number, diameter: number): Shape[] {
  return marker.style === 'commons'
    ? sealShapes(marker.number, cx, cy, diameter)
    : venueSealShapes(marker.number, marker.venueName, cx, cy, diameter);
}
