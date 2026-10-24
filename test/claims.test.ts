/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lotHeading, lotsNamed, minuteKey, parseThread, showTime, trackClaims } from '../src/core/claims';

const synthetic = readFileSync(join(__dirname, 'fixtures/synthetic-purge.txt'), 'utf8');

describe('parseThread', () => {
  it('splits the paste into comments in thread order and drops Facebook chrome', () => {
    const comments = parseThread(synthetic, 'Phil Achleman');
    expect(comments.map((c) => c.author).slice(0, 4)).toEqual([
      'Phil Achleman',
      'Jane Rivera',
      'Marcus Bell',
      'Phil Achleman',
    ]);
    expect(comments[1]).toMatchObject({ body: 'claim', timeHint: '58m', fromSeller: false });
    expect(comments[0].fromSeller).toBe(true);
    expect(comments.some((c) => /write a comment|most relevant|view 2/i.test(c.author + c.body))).toBe(false);
  });

  it('reads one line meta like "5m Like Reply" and glued "5mLikeReply"', () => {
    const a = parseThread('Ana\nclaim\n5m Like Reply\nBo\nclaim\n4mLikeReply');
    expect(a.map((c) => [c.author, c.body, c.timeHint])).toEqual([
      ['Ana', 'claim', '5m'],
      ['Bo', 'claim', '4m'],
    ]);
  });

  it('spots the seller by the Author badge even with no name given', () => {
    const c = parseThread('Phil A\nAuthor\nLot 1\n1h\nLike\nReply');
    expect(c[0].fromSeller).toBe(true);
  });
});

describe('lot reading', () => {
  it('reads lot headings', () => {
    expect(lotHeading('Lot 4: Hoya obovata')).toBe(4);
    expect(lotHeading('#12 Hoya')).toBe(12);
    expect(lotHeading('7) Hoya')).toBe(7);
    expect(lotHeading('Hoya obovata')).toBeNull();
  });

  it('reads lots named in claims and ignores prices', () => {
    expect(lotsNamed('claim 3 and 7')).toEqual([3, 7]);
    expect(lotsNamed('claim #5')).toEqual([5]);
    expect(lotsNamed('12')).toEqual([12]);
    expect(lotsNamed('claim, would you take $20')).toEqual([]);
    expect(lotsNamed('claim 30', 20)).toEqual([]);
  });
});

describe('trackClaims', () => {
  const report = trackClaims(synthetic, { sellerName: 'Phil Achleman', maxLot: 4 });
  const lot = (n: number) => report.lots.find((l) => l.lot === n)!;

  it('orders claims by thread position under each lot', () => {
    expect(lot(1).queue.map((c) => c.author)).toEqual(['Jane Rivera', 'Marcus Bell']);
    expect(lot(2).queue.map((c) => c.author)).toEqual(['Dana Price']);
    expect(lot(4).queue.map((c) => c.author)).toEqual(['Sam Ortiz', 'Dana Price']);
    expect(lot(1).tie).toBeNull();
  });

  it('keeps time hints but never ranks by them', () => {
    // Sam and Dana both show 45m: thread order puts Sam first, and the pair is marked
    // as a same minute tie for the seller to rule on.
    expect(lot(4).queue.map((c) => c.timeHint)).toEqual(['45m', '45m']);
    expect(lot(4).tieKind).toBe('minute');
    expect(lot(4).tie?.map((c) => c.author)).toEqual(['Sam Ortiz', 'Dana Price']);
  });

  it('marks a tie when claims sit in parts of the thread that order cannot separate', () => {
    expect(lot(3).tie?.map((c) => c.author)).toEqual(['Tom Okafor', 'Kim Nguyen']);
    expect(lot(3).tieKind).toBe('thread');
  });

  it('shows a take back it cannot match instead of guessing', () => {
    expect(report.unplaced.map((c) => c.author)).toEqual(['Jane Rivera']);
  });

  it('applies a take back that matches a claim', () => {
    const r = trackClaims('Phil\nAuthor\nLot 1\nLike\nAna\nclaim\nLike\nBo\nclaim\nLike\nAna\nrelease\nLike');
    expect(r.lots[0].queue.map((c) => c.author)).toEqual(['Bo']);
    expect(r.lots[0].released.map((c) => c.author)).toEqual(['Ana']);
  });

  it('works on a thread with no lot comments when buyers name the lot', () => {
    const r = trackClaims('Ana\nclaim 2\nLike\nBo\n2\nLike\nCy\nclaim 1\nLike', { maxLot: 5 });
    expect(r.lots.map((l) => [l.lot, l.queue.map((c) => c.author)])).toEqual([
      [1, ['Cy']],
      [2, ['Ana', 'Bo']],
    ]);
  });

  it('counts a buyer once per lot', () => {
    const r = trackClaims('Ana\nclaim 2\nLike\nAna\nclaim 2!!\nLike', { maxLot: 5 });
    expect(r.lots[0].queue).toHaveLength(1);
  });
});

describe('the October 23 purge thread', () => {
  const thread = readFileSync(join(__dirname, 'fixtures/purge-2026-10-23.txt'), 'utf8');
  const report = trackClaims(thread);
  const lot = (n: number) => report.lots.find((l) => l.lot === n)!;
  const winner = (n: number) => lot(n).queue[0]?.author;

  it('finds the twenty lots from the seller’s priced comments, in order', () => {
    expect(report.lots).toHaveLength(20);
    expect(lot(1).label).toBe('Hoya polyneura $15');
    expect(lot(20).label).toBe('Hoya callistophylla Emerald $25');
  });

  it('reads "sold" as a claim and "next" as a backup behind it', () => {
    expect(lot(2).queue.map((c) => [c.author, c.kind])).toEqual([
      ['Ava Stone', 'claim'],
      ['Bea Lowry', 'claim'],
      ['Cal Moss', 'backup'],
      ['Dee Park', 'backup'],
    ]);
    expect(lot(2).others.map((c) => c.author)).toEqual(['Eve Hart']);
  });

  it('marks exactly the two real ties, inside the same minute, in thread order', () => {
    const ties = report.lots.filter((l) => l.tie);
    expect(ties.map((l) => [l.lot, l.tieKind, l.tie!.map((c) => c.author)])).toEqual([
      [11, 'minute', ['Ivy Cole', 'Jo Banks']],
      [20, 'minute', ['Tess Kerr', 'Wes Ortiz']],
    ]);
    expect(report.lots.find((l) => l.lot === 2)!.tie).toBeNull();
  });

  it('applies the take back on the burmanica and shows what came after it', () => {
    expect(lot(14).queue).toEqual([]);
    expect(lot(14).released.map((c) => c.author)).toEqual(['Uma Price']);
    expect(lot(14).others.map((c) => c.author)).toEqual(['Phil Achleman', 'Uma Price']);
    expect(winner(18)).toBe('Uma Price');
  });

  it('leaves the same three lots unsold that the seller counted', () => {
    expect(report.lots.filter((l) => l.queue.length === 0).map((l) => l.lot)).toEqual([1, 10, 14]);
    expect(report.unplaced).toEqual([]);
  });

  it('ignores follows, chatter and the seller’s own notes', () => {
    const claimed = report.lots.flatMap((l) => l.queue.map((c) => c.author));
    expect(claimed).not.toContain('Phil Achleman');
    expect(claimed).not.toContain('Gin Ames');
    expect(claimed).not.toContain('Yuri Bell');
  });

  it('matches lot comments to the sale’s own lot numbers by name', () => {
    const r = trackClaims(thread, { lots: [{ number: 7, name: 'Hoya latifolia Snow Queen' }] });
    expect(r.lots.find((l) => l.label === 'Hoya latifolia Snow Queen $15')!.lot).toBe(7);
  });

  it('prints exact times for the seller', () => {
    expect(showTime(lot(11).tie![0].timeHint)).toBe('1:29:16 PM');
    expect(minuteKey('5m')).toBe('5m');
    expect(minuteKey('1h')).toBeNull();
    expect(minuteKey('Yesterday at 1:29 PM')).toBe(minuteKey('yesterday at 1:29 pm'));
  });
});
