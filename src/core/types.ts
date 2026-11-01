import type { SecondChance } from './secondChance';

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
  /** Hours a winner has to pay before the lot can go to the next in line. Also how long the runner up gets. */
  payWindowHours?: number;
  /** Commons format only: the Commons Verified Grower number the desk issued, as the seller typed it. */
  growerNumber?: string;
  /** Commons format only: the business name the desk vetted, like "also DBA Gathering Moss". */
  growerBusiness?: string;
  /** The rooms the seller sells in. The fields above mirror the default room, so older code keeps working. */
  venues?: Venue[];
  defaultVenueId?: string;
  /** Set on a profile resolved for one room (see core/venues.ts): which room, its name, and its own lines. */
  venueId?: string;
  venueName?: string;
  city?: string;
  zip?: string;
  /** Hours a buyer has to get in touch once the sale ends. */
  contactHours?: number;
  /** The seller's own checkout form link for this room. */
  formLink?: string;
  /** Default box weight in ounces for label export. */
  weightOz?: number | null;
}

/** One room the seller sells in. Cards, stamps, the deadline line and the form link all draw from it. */
export interface Venue {
  id: string;
  /** Editable text, whatever the room is called today. */
  name: string;
  /** Which card wording this room gets. */
  formatId: FormatId;
  /** The grower or seller number the room issues. Optional, may be empty. */
  number: string;
  /** Commons wording only: the vetted business name. */
  business: string;
  shipping: string;
  shippingDays: number[];
  payment: string;
  /** The seller's standing claim rules for this room. */
  claimRules: string;
  city: string;
  zip: string;
  /** Hours a buyer has to get in touch once the sale ends. */
  contactHours: number;
  /** The seller's own checkout form link, pasted once. */
  formLink: string;
  /** Default box weight in ounces for label export, or null. */
  weightOz: number | null;
}

/** A saved set of sale settings for sellers with a standing way of opening a sale. */
export interface SaleTemplate {
  id: string;
  name: string;
  venueId: string;
  kind: SaleKind;
  claimRules: string;
  crossListing: string;
  note: string;
  contactHours: number;
}

export interface Plant {
  id: string;
  name: string;
  /** True when the plant has no confirmed name. */
  noid: boolean;
  /** Price, or the opening price for an auction. Null when not set yet. */
  price: number | null;
  kind: SaleKind;
  /** App copy of the first photo. The seller's original is never touched. */
  photoUri: string | null;
  /** Every photo of the plant, first one included. Older plants have none here and use photoUri alone. */
  photoUris?: string[];
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
  /** Set price sales only: when the sale ends, so the buyer contact deadline can be a real clock time. */
  endsAt?: SaleTime | null;
  claimRules: string;
  /** Which room this sale runs in. Older sales have none and use the default room. */
  venueId?: string;
  /** What the checkout form calls this sale. Blank means the app names it from the room and the day. */
  name?: string;
  /** Written per sale before copying. Blank by default. */
  note?: string;
  /** Hours a buyer has to get in touch once the sale ends. Pro. */
  contactHours?: number;
  /** Responses imported from the seller's own checkout sheet. Pro. */
  checkout?: CheckoutImport;
  /** Per buyer packing and shipping marks, keyed by buyerKey. Pro. */
  fulfillment?: Record<string, Fulfillment>;
  /** Other rooms or sites where the same plants are listed. */
  crossListing: string;
  lots: Lot[];
  /** The last comment thread pasted into the claim tracker for this sale. */
  claimText?: string;
  /** YYYY-MM-DD, set when the seller closes the sale from the rundown. */
  closedAt?: string;
  /** Lots nobody claimed, as they stood when the sale closed. */
  leftovers?: Lot[];
  /** When the sale closed, in milliseconds, so the payment window can run in hours. */
  closedMs?: number;
  /** The flat shipping charge when the showcase closed, or null when shipping was tiered. */
  shippingCharge?: number | null;
  /** Every lot's claim order when the sale closed, as the Sales Record names it. Second Chance reads it. */
  claimOrder?: Record<number, string[]>;
  offers?: SecondChance[];
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
  photoUris?: string[];
}

/** One row of the seller's checkout sheet, read as the buyer typed it. */
export interface CheckoutResponse {
  /** Position in the imported sheet, from 1. */
  row: number;
  timestamp: string;
  saleName: string;
  facebookName: string;
  email: string;
  shipToName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  /** True when the buyer picked local pickup. */
  pickup: boolean;
  paymentMethod: string;
  note: string;
}

export interface CheckoutImport {
  responses: CheckoutResponse[];
  importedMs: number;
  /** A response the seller assigned to a winner by hand: response row to buyerKey. */
  links?: Record<number, string>;
}

export interface Fulfillment {
  shipped?: boolean;
  tracking?: string;
  /** Box weight in ounces, when it differs from the room's default. */
  weightOz?: number | null;
  /** What the seller charges this buyer for shipping when the room's shipping line isn't one flat amount. */
  shippingCharge?: number | null;
  packed?: boolean;
  /** What the seller says the buyer paid with, so it can be set beside what the form said. */
  paidVia?: string;
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
  /** YYYY-MM-DD, stamped when the lot is marked paid. */
  paidDate?: string;
}
