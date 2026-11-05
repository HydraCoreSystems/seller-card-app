import { trackClaims, type ClaimOptions, type ClaimReport } from './claims';
import type { Profile, Sale } from './types';

/** Reads a pasted thread against the sale's own lots, the same way everywhere in the app. */
export function readClaims(text: string | undefined, sale: Sale, profile: Profile | null): ClaimReport | null {
  if (!text?.trim()) return null;
  return trackClaims(text, claimOptions(sale, profile));
}

/** How claims are read for a sale: the seller's name, the sale's own lots and the highest lot number. The paste box, the clipboard and the screenshots all read with this. */
export function claimOptions(sale: Sale, profile: Profile | null): ClaimOptions {
  const maxLot = sale.lots.reduce((m, l) => Math.max(m, l.number), 0) || undefined;
  return {
    sellerName: profile?.facebookName?.trim() || profile?.sellerName,
    lots: sale.lots.map((l) => ({ number: l.number, name: l.name })),
    maxLot,
  };
}
