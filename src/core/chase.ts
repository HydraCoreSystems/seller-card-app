/**
 * The money chase. After a showcase closes, each buyer still waiting to pay gets a polite
 * reminder the seller copies or sends in one tap, with their lots, their total, the shipping
 * and the seller's payment handles filled in.
 */
import { SHOWCASE } from './brand';
import { firstName } from './buyers';
import { formatDeadline } from './secondChance';
import { formatDay, formatPrice, joinLines } from './text';
import type { Profile } from './types';
import type { RundownBuyer } from './rundown';

/** The shipping charge when the seller's shipping text names one plain amount, like "$8 flat". */
export function flatShipping(text: string): number | null {
  const amounts = text.match(/\$\s?\d+(?:\.\d{1,2})?/g) ?? [];
  return amounts.length === 1 ? Number(amounts[0].replace(/[$\s]/g, '')) : null;
}

export function reminderMessage(
  buyer: Pick<RundownBuyer, 'name' | 'lots' | 'total'>,
  profile: Profile,
  day: string,
  payByMs: number | null,
): string {
  const ship = profile.shipping.trim();
  const flat = flatShipping(ship);
  const totals =
    flat !== null
      ? [`Plants: ${formatPrice(buyer.total)}`, `Shipping: ${formatPrice(flat)}`, `Total: ${formatPrice(buyer.total + flat)}`]
      : ship
        ? [`Plants: ${formatPrice(buyer.total)}`, `Shipping: ${ship}`]
        : [`Total: ${formatPrice(buyer.total)}`];
  return joinLines([
    `Hi ${firstName(buyer.name)}! A friendly reminder about your lots from my ${SHOWCASE} on ${formatDay(day)}.`,
    '',
    ...buyer.lots.map((l) => `Lot ${l.number}, ${l.name}${l.price !== null ? `, ${formatPrice(l.price)}` : ''}`),
    '',
    ...totals,
    '',
    profile.payment.trim() ? `Payment: ${profile.payment.trim()}` : null,
    payByMs !== null ? `Please send it by ${formatDeadline(payByMs, profile.timeZone)}.` : null,
    'Thank you!',
  ]);
}
