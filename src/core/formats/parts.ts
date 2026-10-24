import { formatPrice, formatSaleTime, plantDisplayName } from '../text';
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
