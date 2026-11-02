import { trackClaims, type ClaimReport } from '../core/claims';
import type { Profile, Sale } from '../core/types';

/** Reads a pasted thread against the sale's own lots, the same way everywhere in the app. */
export function readClaims(text: string | undefined, sale: Sale, profile: Profile | null): ClaimReport | null {
  if (!text?.trim()) return null;
  const maxLot = sale.lots.reduce((m, l) => Math.max(m, l.number), 0) || undefined;
  return trackClaims(text, {
    sellerName: profile?.facebookName?.trim() || profile?.sellerName,
    lots: sale.lots.map((l) => ({ number: l.number, name: l.name })),
    maxLot,
  });
}
