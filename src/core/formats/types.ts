import type { FormatId, Lot, Profile, Sale } from '../types';

export interface AnnouncementInput {
  profile: Profile;
  sale: Sale;
}

export interface ListingInput {
  profile: Profile;
  sale: Pick<Sale, 'kind'>;
  lot: Lot;
}

/**
 * A posting format. Every format has both layers: the announcement, built once
 * per sale, and the lean listing, built once per lot. Add a format by writing one
 * of these and registering it in formats/index.ts. Nothing else changes.
 */
export interface CardFormat {
  id: FormatId;
  name: string;
  blurb: string;
  announcement(input: AnnouncementInput): string;
  listing(input: ListingInput): string;
  /** One plant posted on its own: the listing plus the terms a buyer needs. */
  single(input: ListingInput & { claimRules: string }): string;
}
