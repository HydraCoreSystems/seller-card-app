import { SHORT_DAYS, formatPrice, formatSaleTime, joinWords, plantDisplayName } from '../text';
import type { Lot, Profile, Sale, SaleKind } from '../types';

export function sellerLine(profile: Profile): string {
  const number = profile.sellerNumber.trim();
  return number ? `${profile.sellerName.trim()} (Seller #${number})` : profile.sellerName.trim();
}

export function priceLine(kind: SaleKind, price: number | null): string | null {
  if (price === null) return null;
  return kind === 'auction' ? `Opening bid ${formatPrice(price)}` : formatPrice(price);
}

export function lotName(lot: Lot): string {
  return plantDisplayName(lot.name, lot.noid);
}

export function opensLine(sale: Sale, profile: Profile): string | null {
  if (!sale.opens) return null;
  return `Opens ${formatSaleTime(sale.opens, profile.timeZone)}`;
}

export function closesLine(sale: Sale, profile: Profile): string | null {
  if (sale.kind !== 'auction' || !sale.closes) return null;
  return `Closes ${formatSaleTime(sale.closes, profile.timeZone)}`;
}

export function labeled(label: string, value: string): string | null {
  const v = value.trim();
  return v ? `${label}: ${v}` : null;
}

/** The free text shipping note plus the picked ship days, folded into one printed line. */
export function shippingLine(profile: Profile): string | null {
  const base = profile.shipping.trim();
  const days = [...profile.shippingDays].sort((a, b) => a - b).map((d) => SHORT_DAYS[d]);
  const daysSentence = days.length ? `Ships ${joinWords(days)}.` : null;
  // Only close the free text note with a period when another sentence follows it; left
  // untouched otherwise, so sellers who haven't picked days see their own text unchanged.
  const closedBase = base && daysSentence && !/[.!?]$/.test(base) ? `${base}.` : base;
  const combined = [closedBase, daysSentence].filter(Boolean).join(' ');
  return combined ? `Shipping: ${combined}` : null;
}
