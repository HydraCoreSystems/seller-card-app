import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { trackPath } from '../core/resume';
import { useStore } from '../lib/store';

/** Writes down where the seller is whenever they move through a sale. Draws nothing. */
export function ResumeTracker() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const { trackSale, sample } = useStore();
  const lot = params.lot;
  const n = params.n;
  useEffect(() => {
    if (sample) return;
    const tracked = trackPath(pathname, { lot, n });
    if (tracked) trackSale(tracked);
  }, [pathname, lot, n, sample, trackSale]);
  return null;
}
