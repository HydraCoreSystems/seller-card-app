import { useMemo } from 'react';
import { buildCheckoutRows, deadlineState, matchResponses, prefilledLink, saleName } from '../core/checkout';
import { buildRundown } from '../core/rundown';
import type { Sale } from '../core/types';
import { resolveProfile } from '../core/venues';
import { readClaims } from './claimReport';
import { useNow, useStore } from './store';

/** Everything the rundown, the checkout screen and the packing view read for one sale, worked out once. */
export function useCheckout(sale: Sale | undefined) {
  const store = useStore();
  const now = useNow();
  return useMemo(() => {
    if (!sale || !store.profile) return null;
    const room = resolveProfile(store.profile, sale);
    const report = readClaims(sale.claimText, sale, store.profile);
    const rundown = buildRundown({ sale, profile: room, report, records: store.records });
    const deadline = deadlineState(sale, room, now);
    const name = saleName(sale, room);
    const match = matchResponses(sale.checkout?.responses ?? [], rundown.buyers.map((b) => b.name), name, sale.checkout?.links);
    const rows = buildCheckoutRows({ buyers: rundown.buyers, match, fulfillment: sale.fulfillment, profile: room, deadline });
    const link = prefilledLink(room.formLink ?? '', name);
    return { room, rundown, deadline, name, match, rows, link, now };
  }, [sale, store.profile, store.records, now]);
}
