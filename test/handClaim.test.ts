import { describe, expect, it } from 'vitest';
import { trackClaims } from '../src/core/claims';
import { appendHandClaim, handClaimReady } from '../src/core/handClaim';
import { DASH_PATTERN } from '../src/core/text';
import { INTAKE_COPY } from '../src/core/intakeCopy';

const thread = ['Rowan Ellery', 'Author', 'Lot 1: Hoya carnosa $25', 'Like', 'Reply', 'Rowan Ellery', 'Author', 'Lot 2: Hoya kerrii $18', 'Like', 'Reply'].join('\n');
const opts = { sellerName: 'Rowan Ellery' };

describe('recording a claim by hand', () => {
  it('works with nothing pasted at all', () => {
    const text = appendHandClaim('', { buyer: 'Jada Winslow', lot: 3, kind: 'claim' });
    const r = trackClaims(text, opts);
    expect(r.lots.find((l) => l.lot === 3)?.queue.map((c) => c.author)).toEqual(['Jada Winslow']);
    expect(r.unplaced).toHaveLength(0);
  });

  it('lands on the named lot in a thread, in the order entered', () => {
    let text = appendHandClaim(thread, { buyer: 'Jada Winslow', lot: 2, kind: 'claim' });
    text = appendHandClaim(text, { buyer: 'Marcus Bell', lot: 2, kind: 'next' });
    text = appendHandClaim(text, { buyer: 'Priya Lund', lot: 1, kind: 'claim' });
    const r = trackClaims(text, opts);
    expect(r.lots.find((l) => l.lot === 2)?.queue.map((c) => [c.author, c.kind])).toEqual([['Jada Winslow', 'claim'], ['Marcus Bell', 'backup']]);
    expect(r.lots.find((l) => l.lot === 1)?.queue.map((c) => c.author)).toEqual(['Priya Lund']);
  });

  it('keeps the first claim the winner when the same lot is entered twice', () => {
    let text = appendHandClaim('', { buyer: 'Ann Lee', lot: 4, kind: 'claim' });
    text = appendHandClaim(text, { buyer: 'Bo Chen', lot: 4, kind: 'claim' });
    expect(trackClaims(text).lots.find((l) => l.lot === 4)?.queue.map((c) => c.author)).toEqual(['Ann Lee', 'Bo Chen']);
  });

  it('needs a buyer and a lot before it will record', () => {
    expect(handClaimReady('', 3)).toBe(false);
    expect(handClaimReady('Jada', null)).toBe(false);
    expect(handClaimReady('Jada Winslow', 3)).toBe(true);
  });

  it('uses no dashes in the words it shows', () => {
    for (const v of Object.values(INTAKE_COPY)) if (typeof v === 'string') expect(v).not.toMatch(DASH_PATTERN);
  });
});
