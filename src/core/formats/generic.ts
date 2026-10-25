import { MARKET_LISTING, ORIGIN_LINE, SHOWCASE } from '../brand';
import { joinLines } from '../text';
import { closesLine, labeled, lotName, opensLine, priceLine, sellerLine, shippingLine } from './parts';
import type { CardFormat } from './types';

/** A neutral buy sell trade format that works in any room. */
export const generic: CardFormat = {
  id: 'generic',
  name: 'Buy sell trade',
  blurb: 'A plain format that fits any room.',

  announcement({ profile, sale }) {
    const auction = sale.kind === 'auction';
    return joinLines([
      auction ? `${SHOWCASE.toUpperCase()} AUCTION` : SHOWCASE.toUpperCase(),
      `Seller: ${sellerLine(profile)}`,
      '',
      opensLine(sale, profile),
      closesLine(sale, profile),
      auction ? labeled('How the close is called', sale.closeCall) : null,
      '',
      shippingLine(profile),
      labeled('Payment', profile.payment),
      labeled(auction ? 'Bidding rules' : 'Claim rules', sale.claimRules),
      labeled('Also listed in', sale.crossListing),
      '',
      sale.lots.length ? `${sale.lots.length} ${MARKET_LISTING}${sale.lots.length === 1 ? '' : 's'}, numbered in the comments below.` : null,
      '',
      ORIGIN_LINE,
    ]);
  },

  listing({ sale, lot }) {
    return joinLines([
      `Lot ${lot.number}`,
      lotName(lot),
      priceLine(sale.kind, lot.price),
      lot.description.trim() || null,
      '',
      ORIGIN_LINE,
    ]);
  },

  single({ profile, sale, lot, claimRules }) {
    return joinLines([
      MARKET_LISTING.toUpperCase(),
      lotName(lot),
      priceLine(sale.kind, lot.price),
      lot.description.trim() || null,
      '',
      `Seller: ${sellerLine(profile)}`,
      shippingLine(profile),
      labeled('Payment', profile.payment),
      labeled(sale.kind === 'auction' ? 'Bidding rules' : 'Claim rules', claimRules),
      '',
      ORIGIN_LINE,
    ]);
  },
};
