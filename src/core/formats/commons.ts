import { ORIGIN_LINE } from '../brand';
import { joinLines } from '../text';
import { closesLine, labeled, lotName, opensLine, priceLine, sellerLine } from './parts';
import type { CardFormat } from './types';

// The room's name appears only inside this format, never on generic output.
export const COMMONS_NAME = 'The Hoya and Orchid Commons';

// PROVISIONAL: built from the field list in the spec. To be matched line for line
// to the featured sales card post in the Commons once its text is in hand.
export const commons: CardFormat = {
  id: 'commons',
  name: 'Hoya and Orchid Commons',
  blurb: 'The sales card format of The Hoya and Orchid Commons.',

  announcement({ profile, sale }) {
    const auction = sale.kind === 'auction';
    return joinLines([
      `${COMMONS_NAME} ${auction ? 'Auction' : 'Sale'}`,
      `Seller: ${sellerLine(profile)}`,
      `Format: ${auction ? 'Auction' : 'Sale'}`,
      opensLine(sale, profile),
      closesLine(sale, profile),
      auction ? labeled('Close called', sale.closeCall) : null,
      labeled('Shipping', profile.shipping),
      labeled('Payment', profile.payment),
      labeled(auction ? 'Bidding rules' : 'Claim rules', sale.claimRules),
      labeled('Cross listed', sale.crossListing),
      sale.lots.length ? `Lots: ${sale.lots.length}, each in its own comment below` : null,
      '',
      ORIGIN_LINE,
    ]);
  },

  listing({ sale, lot }) {
    return joinLines([
      `Lot ${lot.number}: ${lotName(lot)}`,
      priceLine(sale.kind, lot.price),
      lot.description.trim() || null,
      '',
      ORIGIN_LINE,
    ]);
  },

  single({ profile, sale, lot, claimRules }) {
    const auction = sale.kind === 'auction';
    return joinLines([
      `${COMMONS_NAME} ${auction ? 'Auction' : 'Sale'}`,
      `Seller: ${sellerLine(profile)}`,
      `Plant: ${lotName(lot)}`,
      priceLine(sale.kind, lot.price),
      lot.description.trim() || null,
      labeled('Shipping', profile.shipping),
      labeled('Payment', profile.payment),
      labeled(auction ? 'Bidding rules' : 'Claim rules', claimRules),
      '',
      ORIGIN_LINE,
    ]);
  },
};
