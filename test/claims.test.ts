/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { arrivedBefore, lotHeading, lotsNamed, parseThread, showTime, trackClaims, withoutReplyName, type Claim } from '../src/core/claims';

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
  });

  it('puts claims that show the same minute in the order they arrived, with no tie', () => {
    // Sam and Dana both show 45m. Paste order is their arrival order, so Sam wins and Dana is the alternate.
    expect(lot(4).queue.map((c) => c.timeHint)).toEqual(['45m', '45m']);
    expect(lot(4).queue.map((c) => c.author)).toEqual(['Sam Ortiz', 'Dana Price']);
  });

  it('puts claims from different parts of the thread in one order, with no tie', () => {
    expect(lot(3).queue.map((c) => c.author)).toEqual(['Tom Okafor', 'Kim Nguyen']);
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

  it('resolves the two same minute lots by the second each claim arrived', () => {
    const order = (n: number) => lot(n).queue.map((c) => c.author);
    expect(order(11).slice(0, 2)).toEqual(['Ivy Cole', 'Jo Banks']);
    expect(order(20).slice(0, 2)).toEqual(['Tess Kerr', 'Wes Ortiz']);
    for (const l of report.lots) expect(l).not.toHaveProperty('tie');
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
    expect(showTime(lot(11).queue[0].timeHint)).toBe('1:29:16 PM');
  });
});

const claim = (commentIndex: number, timeHint: string | null): Claim => ({ commentIndex, author: `Buyer ${commentIndex}`, lot: 1, kind: 'claim', timeHint, section: 0, text: 'claim' });

describe('claim order is arrival order, and only arrival order', () => {
  const order = (...c: Claim[]) => [...c].sort(arrivedBefore).map((x) => x.commentIndex);

  it('goes by the exact second when the paste has seconds, even inside one minute', () => {
    const late = claim(1, '2026-10-23T13:29:40.000-04:00');
    const early = claim(2, '2026-10-23T13:29:16.000-04:00');
    expect(order(late, early)).toEqual([2, 1]);
  });

  it('goes by age when the paste has ages like 5m and 2h, oldest first', () => {
    expect(order(claim(1, '5m'), claim(2, '2h'), claim(3, '58m'))).toEqual([2, 3, 1]);
  });

  it('falls to paste order when the times are equal or missing, so two claims never tie', () => {
    expect(order(claim(5, '3m'), claim(4, '3m'))).toEqual([4, 5]);
    expect(order(claim(7, null), claim(6, null))).toEqual([6, 7]);
    expect(order(claim(9, '2026-10-23T13:29:16.000-04:00'), claim(8, '2026-10-23T13:29:16.000-04:00'))).toEqual([8, 9]);
    expect(arrivedBefore(claim(1, '3m'), claim(2, '3m'))).not.toBe(0);
  });

  const post = ['Rowan', 'Author', 'Lot 1: Hoya kerrii $12', '2d', 'Like', 'Reply'];
  const buyer = (name: string, word: string, when: string) => [name, word, when, 'Like', 'Reply'];

  it('gives the lot to the first claim to arrive, and lists the rest as alternates in order', () => {
    const text = [...post, ...buyer('Ana', 'claim', '3m'), ...buyer('Bo', 'claim', '3m'), ...buyer('Cy', 'claim', '3m')].join('\n');
    const lot1 = trackClaims(text, { sellerName: 'Rowan' }).lots.find((l) => l.lot === 1)!;
    expect(lot1.queue.map((c) => c.author)).toEqual(['Ana', 'Bo', 'Cy']);
  });

  it('keeps a claim ahead of any next behind it, each group in arrival order', () => {
    const text = [...post, ...buyer('Ana', 'next', '4m'), ...buyer('Bo', 'claim', '3m'), ...buyer('Cy', 'claim', '3m'), ...buyer('Di', 'next', '2m')].join('\n');
    const lot1 = trackClaims(text, { sellerName: 'Rowan' }).lots.find((l) => l.lot === 1)!;
    expect(lot1.queue.map((c) => [c.author, c.kind])).toEqual([
      ['Bo', 'claim'], ['Cy', 'claim'], ['Ana', 'backup'], ['Di', 'backup'],
    ]);
  });

  it('has no tie state anywhere in the claim report', () => {
    const r = trackClaims(readFileSync(join(__dirname, 'fixtures/purge-2026-10-23.txt'), 'utf8'));
    for (const l of r.lots) {
      expect(Object.keys(l)).not.toContain('tie');
      expect(Object.keys(l)).not.toContain('tieKind');
    }
  });
});

describe('Facebook copy of a lot card with a claim under it', () => {
  const block = [
    'Lot 11',
    'Plant: Hoya sp. Vietnam',
    'Price: $25',
    'Rooted with new growth.',
    'Made with Skrybix by Gathering Moss',
    'Dee Bradshaw',
    'Phil Achleman sold please',
  ].join('\n');

  it('places Dee Bradshaw as the winner of Lot 11', () => {
    for (const sellerName of ['', 'Phil Achleman']) {
      const r = trackClaims(block, { sellerName });
      expect(r.unplaced).toHaveLength(0);
      const lot = r.lots.find((l) => l.lot === 11);
      expect(lot?.queue[0]?.author).toBe('Dee Bradshaw');
    }
  });

  it('keeps the origin line out of claim text and authors', () => {
    const r = trackClaims(block);
    const lot = r.lots.find((l) => l.lot === 11);
    expect(lot?.queue[0]?.text).toBe('sold please');
    expect(JSON.stringify(r)).not.toMatch(/Author":"Made with/);
  });

  it('reads the generic card shape and several lots in order', () => {
    const text = [
      'Lot 1',
      'Hoya kerrii',
      '$15',
      'Made with Skrybix by Gathering Moss',
      'Ann Lee',
      'Phil Achleman mine',
      'Lot 2',
      'Hoya carnosa',
      '$10',
      'Made with Skrybix by Gathering Moss',
      'Bo Chen',
      'Ann Lee sold',
    ].join('\n');
    const r = trackClaims(text);
    expect(r.lots.find((l) => l.lot === 1)?.queue[0]?.author).toBe('Ann Lee');
    expect(r.lots.find((l) => l.lot === 2)?.queue[0]?.author).toBe('Bo Chen');
  });

  it('does not mangle a plain claim or one that comes with meta lines', () => {
    expect(withoutReplyName('Sold please', [])).toBe('Sold please');
    expect(withoutReplyName('Mine Lot 4', [])).toBe('Mine Lot 4');
    const r = trackClaims('Lot 11\nPlant: Hoya\nPrice: $25\nMade with Skrybix by Gathering Moss\nDee Bradshaw\nPhil Achleman sold please\n5m\nLike Reply');
    expect(r.lots.find((l) => l.lot === 11)?.queue[0]?.author).toBe('Dee Bradshaw');
  });
});

describe('a bare lot number is still a buyer claim', () => {
  it('keeps "Lot 5 mine" under a buyer name as a claim', () => {
    const r = trackClaims('Lot 5: Hoya kerrii $12\n2h\nLike Reply\nAnn Lee\nLot 5 mine\n1h\nLike Reply', { sellerName: 'Phil Achleman' });
    expect(r.lots.find((l) => l.lot === 5)?.queue[0]?.author).toBe('Ann Lee');
  });
});
