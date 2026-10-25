export type SaleKind = 'sale' | 'auction';

export type FormatId = 'commons' | 'generic';

export interface Profile {
  sellerName: string;
  /** Optional seller number some rooms assign. */
  sellerNumber: string;
  /** Shipping method and cost, in the seller's own words. */
  shipping: string;
  /** Days plants ship, as day indices (0 Sunday through 6 Saturday). */
  shippingDays: number[];
  /** Payment methods accepted, in the seller's own words. */
  payment: string;
  /** Short time zone label shown on cards, like "Central". */
  timeZone: string;
  /** The seller's standard claim rules, prefilled into every sale. */
  claimRules: string;
  defaultFormat: FormatId;
  /** The seller's name as Facebook shows it, so the claim tracker can tell their comments apart. */
  facebookName?: string;
}

export interface Plant {
  id: string;
  name: string;
  /** True when the plant has no confirmed name. */
  noid: boolean;
  /** Price, or the opening price for an auction. Null when not set yet. */
  price: number | null;
  kind: SaleKind;
  /** App copy of the photo. The seller's original is never touched. */
  photoUri: string | null;
  notes: string;
  sold: boolean;
  createdAt: string;
}

/** A calendar day and clock time, kept as plain text so cards never shift zones. */
export interface SaleTime {
  /** YYYY-MM-DD */
  day: string;
  /** HH:MM, 24 hour */
  time: string;
}

export interface Sale {
  id: string;
  formatId: FormatId;
  kind: SaleKind;
  opens: SaleTime | null;
  /** Auctions only. */
  closes: SaleTime | null;
  /** Auctions only: how the close is called, like "by the clock on my phone". */
  closeCall: string;
  claimRules: string;
  /** Other rooms or sites where the same plants are listed. */
  crossListing: string;
  lots: Lot[];
  /** The last comment thread pasted into the claim tracker for this sale. */
  claimText?: string;
  /** YYYY-MM-DD, set when the seller closes the sale from the rundown. */
  closedAt?: string;
  /** Lots nobody claimed, as they stood when the sale closed. */
  leftovers?: Lot[];
  createdAt: string;
}

export interface Lot {
  number: number;
  plantId: string | null;
  name: string;
  noid: boolean;
  price: number | null;
  description: string;
  photoUri: string | null;
}

export interface SaleRecord {
  id: string;
  saleId: string | null;
  lotNumber: number | null;
  plantName: string;
  buyer: string;
  price: number | null;
  /** YYYY-MM-DD */
  date: string;
  /** Marked from the rundown. Unset means still waiting on the money. */
  payment?: 'paid' | 'never';
}
