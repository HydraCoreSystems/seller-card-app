/**
 * Claim tracker. The seller pastes a Facebook comment thread and gets the claims back
 * in order, lot by lot.
 *
 * Thread order as pasted governs. Facebook only shows relative times like "5m" or
 * "1h", so times are kept as hints for the seller and never used to rank. A tie is a
 * pair of claims that thread order cannot separate. That happens when claims on the
 * same lot sit in different parts of the thread: replies under the lot's own comment
 * on one side, and a comment elsewhere naming the lot number on the other. Facebook
 * groups replies under their parent, so position between those parts says nothing
 * about which came first.
 */

export interface ThreadComment {
  /** Position in the thread as pasted, from 0. */
  index: number;
  author: string;
  body: string;
  timeHint: string | null;
  fromSeller: boolean;
}

export interface Claim {
  commentIndex: number;
  author: string;
  lot: number;
  timeHint: string | null;
  /** Lot whose comment this claim sits under, or 0 for the open thread. */
  section: number;
  text: string;
}

export interface LotClaims {
  lot: number;
  /** Live claims in thread order. The first is the winner unless there's a tie. */
  queue: Claim[];
  /** Claims tied for first, when thread order can't separate them. Null if clear. */
  tie: Claim[] | null;
  /** Claims the buyer took back later in the thread. */
  released: Claim[];
}

export interface ClaimReport {
  comments: ThreadComment[];
  lots: LotClaims[];
  /** Comments that read like claims but name no lot the app could place. */
  unplaced: ThreadComment[];
}

export interface ClaimOptions {
  sellerName?: string;
  /** Highest lot number in the sale, so prices and leaf counts aren't read as lots. */
  maxLot?: number;
}

const BADGES = [
  'top fan', 'author', 'admin', 'moderator', 'top contributor', 'rising contributor',
  'group expert', 'new member', 'conversation starter', 'valued commenter', 'all star contributor',
  'founding member', 'visual storyteller', 'greeter', 'group admin', 'group moderator',
];
const SELLER_BADGES = new Set(['author']);

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
const WEEKDAY = '(?:mon|tues|wednes|thurs|fri|satur|sun)day';
const TIME_HINT = new RegExp(
  `^(?:\\d+\\s?(?:s|m|h|d|w|y|min|mins|hr|hrs|wk|wks)|just now|yesterday(?: at .+)?|${WEEKDAY} at .+|${MONTH} \\d{1,2}(?:,? \\d{4})?(?: at .+)?)$`,
  'i',
);
const META_WORDS = /^(?:like|reply|share|edited|send|follow|hide|see translation)$/i;
const NOISE = [
  /^view (?:all |\d+ )?(?:more |previous )?(?:comments?|replies|reply)/i,
  /^hide (?:replies|reply)/i,
  /^(?:most relevant|all comments|newest|top comments|oldest)$/i,
  /^write a (?:public )?(?:comment|reply)/i,
  /^comment as /i,
  /^press enter to post/i,
  /^\d+ repl(?:y|ies)$/i,
  /^.+ replied$/i,
  /^.+ replied · \d+ repl(?:y|ies)$/i,
  /^(?:gif|sticker|photo|image may contain.*)$/i,
];

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** True for a line made only of a time hint and words like Like and Reply. */
function isMetaLine(line: string): { meta: boolean; time: string | null } {
  const parts = line
    .split(/\s*[·•|]\s*|\s{2,}/)
    .flatMap((p) => p.split(/(?<=\d[smhdwy])(?=[A-Z])|(?<=[a-z])(?=Like|Reply|Share)/))
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return { meta: false, time: null };
  let time: string | null = null;
  let sawMetaWord = false;
  for (const p of parts) {
    if (TIME_HINT.test(p)) time = time ?? p;
    else if (META_WORDS.test(p)) sawMetaWord = true;
    else {
      // "5m Like Reply" written with single spaces
      const words = p.split(/\s+/);
      const t = words[0] && TIME_HINT.test(words[0]) ? words[0] : null;
      const rest = t ? words.slice(1) : words;
      if (rest.length && rest.every((w) => META_WORDS.test(w))) {
        time = time ?? t;
        sawMetaWord = true;
      } else {
        return { meta: false, time: null };
      }
    }
  }
  return { meta: time !== null || sawMetaWord, time };
}

function stripBadge(line: string): { text: string; badge: string | null } {
  const lower = line.toLowerCase();
  for (const b of BADGES) {
    if (lower === b) return { text: '', badge: b };
    if (lower.endsWith(b) && lower.length > b.length) {
      const text = line.slice(0, line.length - b.length).replace(/[\s·]+$/, '');
      if (text) return { text, badge: b };
    }
  }
  return { text: line, badge: null };
}

/** Splits a pasted thread into comments, in the order they were pasted. */
export function parseThread(text: string, sellerName = ''): ThreadComment[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const seller = norm(sellerName);
  const out: ThreadComment[] = [];
  let block: string[] = [];
  let sellerBadge = false;

  const flush = (time: string | null) => {
    let b = block;
    // A reaction count left over from the comment before.
    while (b.length && /^\d+$/.test(b[0]) && b.length > 1) b = b.slice(1);
    if (b.length === 1 && /^\d+$/.test(b[0])) b = [];
    if (b.length) {
      const author = b[0];
      const isSeller = sellerBadge || (seller !== '' && norm(author) === seller);
      out.push({
        index: out.length,
        author,
        body: b.slice(1).join('\n').trim(),
        timeHint: time,
        fromSeller: isSeller,
      });
    }
    block = [];
    sellerBadge = false;
  };

  for (const raw of lines) {
    if (!raw) continue;
    if (NOISE.some((r) => r.test(raw))) continue;
    const meta = isMetaLine(raw);
    if (meta.meta) {
      if (block.length) flush(meta.time);
      else if (meta.time && out.length && out[out.length - 1].timeHint === null) {
        out[out.length - 1].timeHint = meta.time;
      }
      continue;
    }
    const { text: line, badge } = stripBadge(raw);
    if (badge && SELLER_BADGES.has(badge)) sellerBadge = true;
    if (!line) continue;
    block.push(line);
  }
  if (block.length) flush(null);
  return out;
}

const LOT_HEAD = /^(?:lot\s*#?\s*(\d+)|#\s*(\d+)\b|(\d+)\s*[.):])/i;
const CLAIM_WORD = /\b(?:claim(?:ed|ing)?|mine|dibs|i(?:'|’)?ll take|i will take|take it|sold)\b|^c$/i;
const RELEASE_WORD = /\b(?:un ?claim(?:ed|ing)?|release[ds]?|releasing|never ?mind|nvm|cancel(?:led)?|pass(?:ing)?)\b/i;

/** The lot a seller's comment introduces, like "Lot 4: Hoya kerrii". */
export function lotHeading(body: string): number | null {
  const m = body.trim().match(LOT_HEAD);
  if (!m) return null;
  return Number(m[1] ?? m[2] ?? m[3]);
}

/** Lot numbers a buyer names in a comment. */
export function lotsNamed(body: string, maxLot?: number): number[] {
  const found: number[] = [];
  const ok = (n: number) => n >= 1 && (maxLot === undefined || n <= maxLot) && !found.includes(n);
  const text = body.replace(/\$\s*\d+(?:\.\d+)?/g, ' ');
  for (const m of text.matchAll(/(?:lot\s*#?\s*|#\s*)(\d+)/gi)) {
    const n = Number(m[1]);
    if (ok(n)) found.push(n);
  }
  if (found.length === 0 && (CLAIM_WORD.test(text) || RELEASE_WORD.test(text) || isBareLotList(text))) {
    for (const m of text.matchAll(/(?<![\w.])(\d{1,3})(?![\w.%])/g)) {
      const n = Number(m[1]);
      if (ok(n)) found.push(n);
    }
  }
  return found;
}

function isBareLotList(body: string): boolean {
  return /^[\s#\d,&+]*(?:and[\s#\d,&+]*)*$/i.test(body) && /\d/.test(body);
}

export function trackClaims(text: string, options: ClaimOptions = {}): ClaimReport {
  const comments = parseThread(text, options.sellerName ?? '');
  // With no seller name to go on, any comment opening with a lot heading is read as the seller's.
  const sellerKnown = comments.some((c) => c.fromSeller);

  const claims: Claim[] = [];
  const releases: Claim[] = [];
  const unplaced: ThreadComment[] = [];
  let section = 0;

  for (const c of comments) {
    const heading = lotHeading(c.body);
    if (heading !== null && (c.fromSeller || !sellerKnown)) {
      section = heading;
      continue;
    }
    if (c.fromSeller) continue;

    const body = c.body;
    const release = RELEASE_WORD.test(body);
    const claimish = release || CLAIM_WORD.test(body) || isBareLotList(body);
    if (!claimish) continue;

    let lots = lotsNamed(body, options.maxLot);
    if (lots.length === 0 && section > 0) lots = [section];
    if (lots.length === 0) {
      unplaced.push(c);
      continue;
    }
    for (const lot of lots) {
      const claim: Claim = {
        commentIndex: c.index,
        author: c.author,
        lot,
        timeHint: c.timeHint,
        section,
        text: body,
      };
      (release ? releases : claims).push(claim);
    }
  }

  const byLot = new Map<number, LotClaims>();
  const entry = (lot: number) => {
    let e = byLot.get(lot);
    if (!e) {
      e = { lot, queue: [], tie: null, released: [] };
      byLot.set(lot, e);
    }
    return e;
  };

  for (const claim of claims) {
    const e = entry(claim.lot);
    if (e.queue.some((q) => norm(q.author) === norm(claim.author))) continue;
    e.queue.push(claim);
  }
  for (const r of releases) {
    const e = entry(r.lot);
    const i = e.queue.findIndex(
      (q) => norm(q.author) === norm(r.author) && q.commentIndex < r.commentIndex,
    );
    if (i >= 0) e.released.push(...e.queue.splice(i, 1));
    else {
      // A take back that matches no claim on that lot. Show it so the seller can place it.
      const c = comments[r.commentIndex];
      if (!unplaced.includes(c)) unplaced.push(c);
    }
  }
  unplaced.sort((a, b) => a.index - b.index);

  for (const e of byLot.values()) {
    // The earliest claim from each part of the thread. More than one part means
    // thread order can't say who was first.
    const firstBySection = new Map<number, Claim>();
    for (const q of e.queue) if (!firstBySection.has(q.section)) firstBySection.set(q.section, q);
    if (firstBySection.size > 1) {
      e.tie = [...firstBySection.values()].sort((a, b) => a.commentIndex - b.commentIndex);
    }
  }

  const lots = [...byLot.values()]
    .filter((e) => e.queue.length || e.released.length)
    .sort((a, b) => a.lot - b.lot);
  return { comments, lots, unplaced };
}
