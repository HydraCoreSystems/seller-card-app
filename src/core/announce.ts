/**
 * The announcement for a sale, built from the room the sale runs in. The room's own lines, number,
 * city and ZIP come from its profile; the seller's note is written per sale; the buyer contact
 * deadline line is Pro and prints only when the seller has it.
 */
import { contactLine } from './checkout';
import { getFormat } from './formats';
import type { Profile, Sale } from './types';
import { resolveProfile } from './venues';

export function announcementFor(profile: Profile, sale: Sale, pro: boolean): string {
  const room = resolveProfile(profile, sale);
  return getFormat(sale.formatId).announcement({
    profile: room,
    sale,
    note: sale.note,
    contactLine: pro ? contactLine(sale, room) : null,
  });
}

/** The lean listing for one lot, from the sale's room. */
export function listingFor(profile: Profile, sale: Sale, lot: Sale['lots'][number]): string {
  return getFormat(sale.formatId).listing({ profile: resolveProfile(profile, sale), sale, lot });
}
