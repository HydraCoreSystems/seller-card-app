import { useMemo } from 'react';
import { checkoutModel } from '../core/checkoutModel';
import type { Sale } from '../core/types';
import { useNow, useStore } from './store';

/** Everything the rundown, the checkout screen and the packing view read for one sale, worked out once. */
export function useCheckout(sale: Sale | undefined) {
  const store = useStore();
  const now = useNow();
  return useMemo(() => {
    if (!sale || !store.profile) return null;
    return checkoutModel(sale, store.profile, store.records, now);
  }, [sale, store.profile, store.records, now]);
}
