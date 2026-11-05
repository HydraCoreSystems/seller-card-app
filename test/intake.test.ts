import { describe, expect, it } from 'vitest';
import { parseThread, showTime, SCREENSHOT_TIME, trackClaims } from '../src/core/claims';
import { EMPTY_DRAFT, commentsFromScreens, looksLikeThread, mergeIntoThread, readIntake, serializeThread, unreadableName, type IntakeDraft } from '../src/core/intake';
import { DASH_PATTERN } from '../src/core/text';

const SELLER = 'Rowan Ellery';
const opts = { sellerName: SELLER };

// What the device reads off three overlapping screenshots of one messy sale thread. Blocks come back the way
// Android groups them (a name and its comment can share a block) and the way iPhone does (line by line).
const shot1 = [
  'Most relevant',
  'Rowan Ellery\nAuthor',
  'Lot 1: Hoya carnosa Krimson Queen $25',
  '2d Like Reply',
  'Jada Winslow',
  'Claim!!',
  '3m Like Reply',
  'Marcus Bell\nnext',
  '3m Like Reply',
  'Jada Winslow replied · 1 reply',
  'Rowan Ellery\nAuthor',
  'Lot 2: Hoya kerrii splash $18',
  '2d Like Reply',
  'Priya Lund',
  'sold',
  '2m Like Reply',
];
const shot2 = [
  // The overlap: the last comment of the first screenshot shows again at the top of the second.
  'Priya Lund',
  'sold',
  '2m Like Reply',
  // An age that disagrees with the order on screen. Position still decides.
  'Theo Marsh\nmine',
  '10m Like Reply',
  'Dana Price\nI’ll take it!',
  '1m Like Reply',
  'View 3 more replies',
  'Rowan Ellery\nAuthor',
  'Lot 3: Hoya NOID $12',
  '2d Like Reply',
  'Sam Ortiz',
  'dibs',
  '1m Like Reply',
];
const shot3 = [
  // Cut off at the top: the end of someone's comment with no name above it.
  'so pretty, does it come potted?',
  '1m Like Reply',
  'Kim Nguyen\nNEXT please',
  '1m Like Reply',
  'Leo Hart',
  'claim',
  '1m Like Reply',
];

const draft = (screens: string[][], extra: Partial<IntakeDraft> = {}): IntakeDraft => ({ ...EMPTY_DRAFT, screens, ...extra });
const read = (screens: string[][], extra: Partial<IntakeDraft> = {}) => readIntake(draft(screens, extra), opts);
const queue = (r: ReturnType<typeof read>, lot: number) => r.report.lots.find((l) => l.lot === lot)?.queue.map((c) => [c.author, c.kind]);

describe('claims from screenshots', () => {
  const r = read([shot1, shot2, shot3]);

  it('reads mixed claim words and next calls into the claim list, top to bottom', () => {
    expect(queue(r, 1)).toEqual([['Jada Winslow', 'claim'], ['Marcus Bell', 'backup']]);
    expect(queue(r, 2)).toEqual([['Priya Lund', 'claim'], ['Theo Marsh', 'claim'], ['Dana Price', 'claim']]);
    expect(queue(r, 3)).toEqual([['Sam Ortiz', 'claim'], ['Leo Hart', 'claim'], ['Kim Nguyen', 'backup']]);
  });

  it('wins the lot for the first claim on screen, and lists the rest as alternates in order', () => {
    expect(r.report.lots.find((l) => l.lot === 2)!.queue[0].author).toBe('Priya Lund');
  });

  it('counts a comment shown at the bottom of one screenshot and the top of the next only once', () => {
    expect(queue(r, 2)!.filter(([a]) => a === 'Priya Lund')).toHaveLength(1);
  });

  it('takes the order from where comments sit on screen, never from the ages printed beside them', () => {
    // Theo shows 10m and Dana 1m, so by age Theo is older. Both orders agree here; flip them to prove it.
    const flipped = [shot1, [...shot2.slice(0, 3), 'Dana Price\nI’ll take it!', '1m Like Reply', 'Theo Marsh\nmine', '10m Like Reply', ...shot2.slice(7)], shot3];
    expect(queue(read(flipped), 2)!.map(([a]) => a)).toEqual(['Priya Lund', 'Dana Price', 'Theo Marsh']);
    for (const c of commentsFromScreens(flipped, SELLER)) expect(c.timeHint).toBeNull();
  });

  it('follows the order the screenshots were picked in', () => {
    const a = ['Ana Cruz\nclaim lot 1', '1m Like Reply'];
    const b = ['Bo Lane\nclaim lot 1', '1m Like Reply'];
    expect(queue(read([a, b]), 1)!.map(([n]) => n)).toEqual(['Ana Cruz', 'Bo Lane']);
    expect(queue(read([b, a]), 1)!.map(([n]) => n)).toEqual(['Bo Lane', 'Ana Cruz']);
  });

  it('names the screenshot every claim came from', () => {
    const jada = r.report.lots.find((l) => l.lot === 1)!.queue[0];
    expect(r.screenOf(jada.commentIndex)).toBe(0);
    const leo = r.report.lots.find((l) => l.lot === 3)!.queue.find((c) => c.author === 'Leo Hart')!;
    expect(r.screenOf(leo.commentIndex)).toBe(2);
  });

  it('keeps reply chrome and view more lines out of the claims', () => {
    const names = r.kept.map((c) => c.author);
    expect(names).not.toContain('Jada Winslow replied');
    expect(names.some((n) => /view 3 more/i.test(n))).toBe(false);
  });

  it('carries no time on any claim, and shows none', () => {
    for (const l of r.report.lots) for (const c of l.queue) expect(showTime(c.timeHint)).toBeNull();
    expect(showTime(SCREENSHOT_TIME)).toBeNull();
  });
});

describe('what cannot be read is flagged, not guessed', () => {
  const r = read([shot1, shot2, shot3]);

  it('holds back a comment whose name could not be read', () => {
    const f = r.flagged.filter((x) => x.why === 'name');
    expect(f).toHaveLength(1);
    expect(f[0].comment.author).toBe('so pretty, does it come potted?');
    expect(r.kept.map((c) => c.author)).not.toContain('so pretty, does it come potted?');
    expect(unreadableName('so pretty, does it come potted?')).toBe(true);
    expect(unreadableName('Jada Winslow')).toBe(false);
    expect(unreadableName('7')).toBe(true);
  });

  it('holds back a claim that names no lot, and lets the seller say which', () => {
    const noLot = [['Rowan Ellery\nAuthor', 'Hoya post with no lot number', '2d Like Reply', 'Ivy Cole\nclaim', '1m Like Reply']];
    const flagged = read(noLot).flagged;
    expect(flagged.map((f) => [f.why, f.comment.author])).toEqual([['lot', 'Ivy Cole']]);
    const fixed = read(noLot, { added: { [flagged[0].comment.origin]: { name: 'Ivy Cole', lot: 1, kind: 'claim' } } });
    expect(fixed.flagged).toEqual([]);
    expect(queue(fixed, 1)).toEqual([['Ivy Cole', 'claim']]);
  });

  it('puts a hand added claim where it sat on screen, never at the end', () => {
    const f = r.flagged.find((x) => x.why === 'name')!;
    const added = read([shot1, shot2, shot3], { added: { [f.comment.origin]: { name: 'Mo Reyes', lot: 3, kind: 'claim' } } });
    // The cut off comment sat after Sam, Leo is below it, so Mo lands between them.
    expect(queue(added, 3)!.map(([a]) => a)).toEqual(['Sam Ortiz', 'Mo Reyes', 'Leo Hart', 'Kim Nguyen']);
  });

  it('lets the seller take a comment off the list, and nothing else about order', () => {
    const jada = r.kept.find((c) => c.author === 'Jada Winslow')!;
    const trimmed = read([shot1, shot2, shot3], { removed: [jada.origin] });
    expect(queue(trimmed, 1)).toEqual([['Marcus Bell', 'backup']]);
    expect(queue(trimmed, 2)).toEqual(queue(r, 2));
  });

  it('flags every unreadable name, not just the first', () => {
    const two = read([['Rowan Ellery\nAuthor', 'Lot 1: Hoya $5', '2d Like Reply', 'and then I said no way.', 'claim', '1m Like Reply', 'maybe later, thanks!', 'claim', '1m Like Reply']]);
    expect(two.flagged.map((f) => f.why)).toEqual(['name', 'name']);
  });
});

describe('what gets saved when the seller confirms', () => {
  const r = read([shot1, shot2, shot3]);

  it('reads back as the same claim list through the same parser the paste box uses', () => {
    const text = mergeIntoThread(undefined, r, SELLER);
    const back = trackClaims(text, opts);
    for (const lot of [1, 2, 3]) expect(back.lots.find((l) => l.lot === lot)!.queue.map((c) => c.author)).toEqual(r.report.lots.find((l) => l.lot === lot)!.queue.map((c) => c.author));
  });

  it('goes after what was already saved, because it arrived after it', () => {
    const before = 'Rowan Ellery\nAuthor\nLot 1: Hoya carnosa $25\n2d\nLike\nReply\nZed Early\nclaim\n2d\nLike\nReply';
    const text = mergeIntoThread(before, read([['Jada Winslow', 'claim lot 1', '1m Like Reply']]), SELLER);
    expect(trackClaims(text, opts).lots.find((l) => l.lot === 1)!.queue.map((c) => c.author)).toEqual(['Zed Early', 'Jada Winslow']);
  });

  it('merges into an exported thread without breaking it', () => {
    const exported = 'Author: Rowan Ellery\n[1] Rowan Ellery | 2026-11-03T18:00:00.000-05:00\nLot 1: Hoya carnosa $25\n[2] Zed Early | 2026-11-03T18:01:00.000-05:00\nclaim';
    const text = mergeIntoThread(exported, read([['Jada Winslow', 'claim lot 1', '1m Like Reply']]), SELLER);
    expect(parseThread(text, SELLER).map((c) => c.author)).toEqual(['Rowan Ellery', 'Zed Early', 'Jada Winslow']);
  });

  it('keeps the seller marked, so lot comments still open lots', () => {
    const text = serializeThread(r.kept, false, SELLER);
    expect(parseThread(text, SELLER).filter((c) => c.fromSeller)).toHaveLength(3);
  });

  it('does not double a buyer who shows up in two batches', () => {
    const once = mergeIntoThread(undefined, read([shot1]), SELLER);
    const twice = mergeIntoThread(once, read([shot1]), SELLER);
    const q = trackClaims(twice, opts).lots.find((l) => l.lot === 1)!.queue;
    expect(q.map((c) => c.author)).toEqual(['Jada Winslow', 'Marcus Bell']);
  });
});

describe('the clipboard shortcut', () => {
  const copied = 'Rowan Ellery\nAuthor\nLot 4: Dischidia $15\n2d\nLike\nReply\nPriya Lund\nclaim\n3m\nLike\nReply';

  it('offers a thread copied from Facebook', () => {
    expect(looksLikeThread(copied, opts)).toBe(true);
  });

  it('offers an export from a connector', () => {
    expect(looksLikeThread('[1] Priya Lund | 2026-11-03T18:00:00.000-05:00\nclaim\n[2] Theo Marsh | 2026-11-03T18:01:00.000-05:00\nnext', opts)).toBe(true);
  });

  it('offers a thread with claims that name no lot, so the seller can place them', () => {
    expect(looksLikeThread('Priya Lund\nclaim\n3m\nLike\nReply', opts)).toBe(true);
  });

  it('stays quiet for anything else that was copied', () => {
    for (const t of ['', '   ', 'hi', 'https://example.com/a/page', 'Pick up milk and eggs\non the way home', 'Rowan Ellery\nAuthor\nLot 1: Hoya $5\n2d\nLike\nReply', 'x'.repeat(500_000)]) {
      expect(looksLikeThread(t, opts), t.slice(0, 30)).toBe(false);
    }
    expect(looksLikeThread(null, opts)).toBe(false);
    expect(looksLikeThread(undefined, opts)).toBe(false);
  });

  it('stays quiet when the thread is the one already saved', () => {
    expect(looksLikeThread(copied, opts, copied)).toBe(false);
    expect(looksLikeThread(copied, opts, `${copied}\n`)).toBe(false);
    expect(looksLikeThread(copied, opts, 'something older')).toBe(true);
  });

  it('feeds the same claim logic as a paste', () => {
    const q = trackClaims(copied, opts).lots.find((l) => l.lot === 4)!.queue;
    expect(q.map((c) => c.author)).toEqual(['Priya Lund']);
  });
});

describe('the intake words', () => {
  it('has a fresh draft that is empty', () => {
    expect(EMPTY_DRAFT).toEqual({ screens: [], removed: [], added: {} });
    expect(readIntake(EMPTY_DRAFT, opts).kept).toEqual([]);
  });
  it('uses no dashes in the markers it writes', () => {
    expect(DASH_PATTERN.test(SCREENSHOT_TIME)).toBe(false);
  });
});

import { INTAKE_COPY } from '../src/core/intakeCopy';

describe('the intake copy', () => {
  it('has no dashes of any kind', () => {
    const all = Object.values(INTAKE_COPY).map((v) => (typeof v === 'function' ? v(2) : v));
    for (const t of [...all, INTAKE_COPY.someFailed(1)]) expect(DASH_PATTERN.test(t), t).toBe(false);
  });
});
