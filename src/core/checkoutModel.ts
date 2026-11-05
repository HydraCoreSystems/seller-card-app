/**
 * Everything the rundown, the checkout screen, the packing view and the computer version read for
 * one sale, worked out from plain data. No phone, no screen: the same answer on every device.
 */
import { readClaims } from './claimReport';
import { buildCheckoutRows, deadlineState, matchResponses, prefilledLink, saleName } from './checkout';
import { buildRundown } from './rundown';
import type { Profile, Sale, SaleRecord } from './types';
import { resolveProfile } from './venues';

export function checkoutModel(sale: Sale, profile: Profile, records: SaleRecord[], now: number) {
  const room = resolveProfile(profile, sale);
  const report = readClaims(sale.claimText, sale, profile);
  const rundown = buildRundown({ sale, profile: room, report, records });
  const deadline = deadlineState(sale, room, now);
  const name = saleName(sale, room);
  const match = matchResponses(sale.checkout?.responses ?? [], rundown.buyers.map((b) => b.name), name, sale.checkout?.links);
  const rows = buildCheckoutRows({ buyers: rundown.buyers, match, fulfillment: sale.fulfillment, profile: room, deadline });
  const link = prefilledLink(room.formLink ?? '', name);
  return { room, rundown, deadline, name, match, rows, link, now };
}
