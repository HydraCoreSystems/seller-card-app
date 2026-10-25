import { MARKET_LISTING, ORIGIN_LINE, SHOWCASE } from '../brand';
import { formatPrice, formatSaleTime, joinLines } from '../text';
import type { Lot, Profile, Sale, SaleKind } from '../types';
import { lotName, shippingLine } from './parts';
import type { CardFormat } from './types';

// The room's name appears only inside this format, never on generic output.
export const COMMONS_NAME = 'The Hoya and Orchid Commons';
// The room's own words for its selling space and its approved sellers. Commons format only.
export const COMMONS_MARKET = 'Commons Market';
export const VERIFIED_GROWER = 'Commons Verified Grower';

// Matched line for line to THE COMMONS SALES CARD, the template in the room's featured
// sales card post. Field order and wording follow it; only the blanks are filled.
const CLAIMS_LINE = 'Claims in this thread only. First confirmed claim takes it.';
const BIDS_LINE = 'Bids in this thread only. A bid in the final five minutes extends the close by five minutes.';

function sellerLine(profile: Profile): string {
  const number = profile.sellerNumber.trim();
  const name = profile.sellerName.trim();
  return number ? `Seller: ${name} · ${VERIFIED_GROWER} No. ${number}` : `Seller: ${name}`;
}

function priceLine(kind: SaleKind, price: number | null, closes: string | null): string | null {
  if (kind === 'auction') {
    const opens = price === null ? 'Auction.' : `Auction. Opens at ${formatPrice(price)}.`;
    return closes ? `${opens} Closes ${closes}.` : opens;
  }
  return price === null ? null : `Price: ${formatPrice(price)}`;
}

function alsoListed(crossListing: string): string {
  return `Also listed at: ${crossListing.trim() || 'only here'}`;
}

function closesText(sale: Pick<Sale, 'kind' | 'closes'>, profile: Profile): string | null {
  return sale.kind === 'auction' && sale.closes ? formatSaleTime(sale.closes, profile.timeZone) : null;
}

function termsLines(profile: Profile, crossListing: string) {
  return [
    shippingLine(profile),
    profile.payment.trim() ? `Payment: ${profile.payment.trim()}` : null,
    alsoListed(crossListing),
  ];
}

/** The seller's own extra terms, printed under the room's line when they add something. */
function extraRules(rules: string): string | null {
  const r = rules.trim();
  return r && r !== CLAIMS_LINE ? r : null;
}

function plantLines(kind: SaleKind, lot: Lot, closes: string | null) {
  return [`Plant: ${lotName(lot)}`, priceLine(kind, lot.price, closes), lot.description.trim() || null];
}

export const commons: CardFormat = {
  id: 'commons',
  name: 'Hoya and Orchid Commons',
  blurb: 'The Commons sales card, filled in.',

  // Layer one: everything on the card that's the same for every lot, posted once.
  announcement({ profile, sale }) {
    const auction = sale.kind === 'auction';
    const closes = closesText(sale, profile);
    return joinLines([
      sellerLine(profile),
      sale.lots.length
        ? `${auction ? `${SHOWCASE} auction` : SHOWCASE}: ${sale.lots.length} plants, each on its own ${MARKET_LISTING} in the comments below`
        : null,
      sale.opens ? `Opens ${formatSaleTime(sale.opens, profile.timeZone)}` : null,
      auction && closes ? `Closes ${closes}` : null,
      auction && sale.closeCall.trim() ? sale.closeCall.trim() : null,
      ...termsLines(profile, sale.crossListing),
      '',
      auction ? BIDS_LINE : CLAIMS_LINE,
      extraRules(sale.claimRules),
      '',
      ORIGIN_LINE,
    ]);
  },

  // Layer two: the lot's own lines of the card.
  listing({ sale, lot }) {
    return joinLines([`Lot ${lot.number}`, ...plantLines(sale.kind, lot, null), '', ORIGIN_LINE]);
  },

  // One plant posted on its own: the whole card.
  single({ profile, sale, lot, claimRules }) {
    return joinLines([
      sellerLine(profile),
      ...plantLines(sale.kind, lot, null),
      ...termsLines(profile, ''),
      '',
      sale.kind === 'auction' ? BIDS_LINE : CLAIMS_LINE,
      extraRules(claimRules),
      '',
      ORIGIN_LINE,
    ]);
  },
};
