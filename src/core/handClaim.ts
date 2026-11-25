import { isConnectorExport } from './claims';
import { serializeThread } from './intake';

/** A claim the seller types in for a named buyer on a named lot, in seller words. */
export interface HandClaim {
  buyer: string;
  lot: number;
  /** "claim" takes the lot; "next" waits in line behind whoever claimed first. */
  kind: 'claim' | 'next';
}

/** True when there is enough to record: a buyer name with some letters, and a real lot. */
export function handClaimReady(buyer: string, lot: number | null): boolean {
  return buyer.trim().length >= 2 && /[a-z]/i.test(buyer) && lot !== null && lot >= 1;
}

/**
 * Adds the claim to the end of the thread text the sale keeps. It arrives after everything already there, so
 * it takes its place in line by when it was entered, the same rule every other claim follows.
 */
export function appendHandClaim(existing: string | undefined, claim: HandClaim): string {
  const before = (existing ?? '').trim();
  const connector = before ? isConnectorExport(before.split('\n')) : false;
  const body = `${claim.kind === 'next' ? 'next' : 'claim'} lot ${claim.lot}`;
  const row = serializeThread([{ index: 0, author: claim.buyer.trim().replace(/\s+/g, ' '), body, timeHint: null, fromSeller: false, parent: null }], connector, '');
  // The furniture line keeps the claim above from running into this one when the thread was pasted without any.
  return [before, before && !connector ? 'Like\nReply' : '', row].filter(Boolean).join('\n');
}
