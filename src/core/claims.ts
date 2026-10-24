/**
 * Claim tracker. The seller pastes a sale thread and gets the claims back lot by lot.
 *
 * Thread order as pasted governs who is first. Times are kept as hints and printed for
 * the seller, never used to rank. Two kinds of tie are marked for the seller to rule on:
 *
 *  - minute: the first claims on a lot land inside the same minute. Thread order still
 *    shows who is first, and the seller sees both times, as the Commons tie ladder asks.
 *  - thread: claims on the same lot sit in parts of the thread whose order can't be
 *    compared, like replies under the lot's own comment against a top level comment
 *    naming the lot number.
 *
 * Two kinds of paste are read: a thread copied from Facebook, and a connector export
 * with "[n] Name | time" headers and indented "Reply:" lines.
 */

export interface ThreadComment {
  /** Position in the thread as pasted, from 0. */
  index: number;
  author: string;
  body: string;
  /** The time as it appeared, like "5m" or "2026-10-23T13:29:16.000-04:00". */
  timeHint: string | null;
  fromSeller: boolean;
  /** Index of the top level comment this replies to, when the paste shows nesting. */
  parent: number | null;
}

export type ClaimKind = 'claim' | 'backup';

export interface Claim {
  commentIndex: number;
  author: string;
  lot: number;
  kind: ClaimKind;
  timeHint: string | null;
  /** Lot whose comment this claim sits under, or 0 for the open thread. */
  section: number;
  text: string;
}

export interface LotClaims {
  lot: number;
  /** The seller's own comment that opened the lot, when the thread has one. */
  label: string | null;
  /** Live claims in thread order, then backups ("next") in thread order. */
  queue: Claim[];
  /** Claims tied for first, in thread order. Null when first place is clear. */
  tie: Claim[] | null;
  tieKind: 'minute' | 'thread' | null;
  /** Claims the buyer took back later in the thread. */
  released: Claim[];
  /** Everything else said under this lot, so the seller rules with full sight. */
  others: ThreadComment[];
}

export interface ClaimReport {
  comments: ThreadComment[];
  lots: LotClaims[];
  /** Comments that read like claims or take backs but name no lot the app could place. */
  unplaced: ThreadComment[];
}

export interface ClaimOptions {
  /** The seller's name as it shows on Facebook. */
  sellerName?: string;
  /** The sale's lots, so lot comments can be matched by plant name. */
  lots?: { number: number; name: string }[];
  /** Highest lot number in the sale, so prices and leaf counts aren't read as lots. */
  maxLot?: number;
}

/* ---------- reading the paste ---------- */

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

const CONNECTOR_TOP = /^\[\d+\]\s+(.+?)\s+\|\s+(\S+)\s*$/;
const CONNECTOR_REPLY = /^Reply:\s+(.+?)\s+\|\s+(\S+)\s*$/;
const UNKNOWN_AUTHOR = /^\(author name not returned.*\)$/i;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** "@[1738965192:2048:Phil Achleman] sold" reads as "@Phil Achleman sold". */
export function cleanMentions(text: string): string {
  return text.replace(/@\[\d+:\d+:([^\]]+)\]/g, '@$1');
}

/** The words of a comment with any opening @mentions taken off. */
function spoken(body: string, names: string[]): string {
  let t = cleanMentions(body).trim();
  while (t.startsWith('@')) {
    const hit = names.find((n) => n && t.slice(1).toLowerCase().startsWith(n.toLowerCase()));
    t = hit ? t.slice(1 + hit.length).trim() : t.replace(/^@\S+/, '').trim();
  }
  return t;
}

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

function isConnectorExport(lines: string[]): boolean {
  return lines.some((l) => CONNECTOR_TOP.test(l.trim()));
}

function parseConnector(lines: string[], sellerName: string): ThreadComment[] {
  // The post's own author, printed above the comments, is the seller.
  const authorLine = lines.find((l) => /^Author:\s+/.test(l.trim()));
  const sellers = [norm(sellerName), norm(authorLine?.trim().replace(/^Author:\s+/, '') ?? '')].filter(Boolean);
  const start = lines.findIndex((l) => CONNECTOR_TOP.test(l.trim()));
  const out: ThreadComment[] = [];
  let current: ThreadComment | null = null;
  let lastTop: number | null = null;
  for (const raw of lines.slice(start)) {
    const line = raw.trim();
    if (/^={5,}$|^-{5,}$/.test(line)) continue;
    const m = line.match(CONNECTOR_TOP) ?? line.match(CONNECTOR_REPLY);
    if (m) {
      const isReply = !CONNECTOR_TOP.test(line);
      const author = UNKNOWN_AUTHOR.test(m[1]) ? 'Unknown' : m[1];
      current = {
        index: out.length,
        author,
        body: '',
        timeHint: m[2],
        fromSeller: sellers.includes(norm(author)),
        parent: isReply ? lastTop : null,
      };
      if (!isReply) lastTop = current.index;
      out.push(current);
      continue;
    }
    if (current && line) current.body = current.body ? `${current.body}\n${line}` : line;
  }
  return out;
}

function parseCopied(lines: string[], sellerName: string): ThreadComment[] {
  const seller = norm(sellerName);
  const out: ThreadComment[] = [];
  let block: string[] = [];
  let sellerBadge = false;

  const flush = (time: string | null) => {
    let b = block;
    // A reaction count left over from the comment before.
    while (b.length > 1 && /^\d+$/.test(b[0])) b = b.slice(1);
    if (b.length === 1 && /^\d+$/.test(b[0])) b = [];
    if (b.length) {
      const author = b[0];
      out.push({
        index: out.length,
        author,
        body: b.slice(1).join('\n').trim(),
        timeHint: time,
        fromSeller: sellerBadge || (seller !== '' && norm(author) === seller),
        parent: null,
      });
    }
    block = [];
    sellerBadge = false;
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (NOISE.some((r) => r.test(trimmed))) continue;
    const meta = isMetaLine(trimmed);
    if (meta.meta) {
      if (block.length) flush(meta.time);
      else if (meta.time && out.length && out[out.length - 1].timeHint === null) {
        out[out.length - 1].timeHint = meta.time;
      }
      continue;
    }
    const { text: line, badge } = stripBadge(trimmed);
    if (badge && SELLER_BADGES.has(badge)) sellerBadge = true;
    if (!line) continue;
    block.push(line);
  }
  if (block.length) flush(null);
  return out;
}

/** Splits a pasted thread into comments, in the order they were pasted. */
export function parseThread(text: string, sellerName = ''): ThreadComment[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  return isConnectorExport(lines) ? parseConnector(lines, sellerName) : parseCopied(lines, sellerName);
}

/* ---------- times ---------- */

/** A key that is equal for two times inside the same minute, or null if the hint is too coarse. */
export function minuteKey(hint: string | null): string | null {
  if (!hint) return null;
  const iso = hint.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (iso) return iso[1];
  const h = hint.trim().toLowerCase();
  if (/\d{1,2}:\d{2}/.test(h)) return h.replace(/(\d{1,2}:\d{2}):\d{2}/, '$1');
  if (/^(?:just now|\d+\s?(?:s|m|min|mins))$/.test(h)) return h.replace(/\s/g, '');
  return null;
}

/** "1:29:16 PM" for exact times; anything else as it came. */
export function showTime(hint: string | null): string | null {
  if (!hint) return null;
  const iso = hint.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):(\d{2})/);
  if (!iso) return hint;
  const h = Number(iso[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${iso[2]}:${iso[3]} ${h >= 12 ? 'PM' : 'AM'}`;
}

/* ---------- reading claims ---------- */

const LOT_HEAD = /^(?:lot\s*#?\s*(\d+)|#\s*(\d+)\b|(\d+)\s*[.):])/i;
const PRICED = /\$\s?\d/;
const CLAIM_WORD = /\b(?:claim(?:ed|ing)?|sold|mine|dibs|i(?:'|’)?ll take(?: it)?|i will take|take it|want it)\b|^c$/i;
const BACKUP_WORD = /\b(?:next|backup|back up)\b/i;
const RELEASE_WORD = /\b(?:un ?claim(?:ed|ing)?|release[ds]?|releasing|never ?mind|nvm|cancel(?:led)?|pass(?:ing)?|do(?:n'?t|n’t| not) want|wrong one)\b/i;

/** The lot a seller's comment introduces, like "Lot 4: Hoya kerrii". */
export function lotHeading(body: string): number | null {
  const m = body.trim().match(LOT_HEAD);
  if (!m) return null;
  return Number(m[1] ?? m[2] ?? m[3]);
}

function isBareLotList(body: string): boolean {
  return /^[\s#\d,&+]*(?:and[\s#\d,&+]*)*$/i.test(body) && /\d/.test(body);
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
  if (found.length === 0 && intentOf(text) !== null) {
    for (const m of text.matchAll(/(?<![\w.])(\d{1,3})(?![\w.%])/g)) {
      const n = Number(m[1]);
      if (ok(n)) found.push(n);
    }
  }
  return found;
}

type Intent = 'claim' | 'backup' | 'release' | null;

function intentOf(words: string): Intent {
  if (RELEASE_WORD.test(words)) return 'release';
  if (BACKUP_WORD.test(words)) return 'backup';
  if (CLAIM_WORD.test(words) || isBareLotList(words)) return 'claim';
  return null;
}

export function trackClaims(text: string, options: ClaimOptions = {}): ClaimReport {
  const comments = parseThread(text, options.sellerName ?? '');
  const sellerKnown = comments.some((c) => c.fromSeller);
  const nested = comments.some((c) => c.parent !== null);
  const names = [...new Set(comments.map((c) => c.author))].sort((a, b) => b.length - a.length);

  const lotOfComment = new Map<number, number>();
  const labels = new Map<number, string>();
  const used = new Set<number>();
  // Numbers the sale already gave out stay theirs; unmatched lot comments count around them.
  const reserved = new Set(options.lots?.map((l) => l.number) ?? []);
  let auto = 0;

  // Which lot a seller comment opens: "Lot N", a sale lot named in it, or the next number
  // for a priced comment like "Hoya polyneura $15". Anything else is the seller chatting.
  const sellerLot = (c: ThreadComment): number | null => {
    const heading = lotHeading(c.body);
    if (heading !== null) return heading;
    if (!c.fromSeller || !PRICED.test(c.body) || c.body.length > 300) return null;
    const said = norm(c.body);
    const match = options.lots?.find((l) => norm(l.name) && said.includes(norm(l.name)) && !used.has(l.number));
    if (match) return match.number;
    do auto += 1;
    while (used.has(auto) || reserved.has(auto));
    return auto;
  };

  const claims: Claim[] = [];
  const releases: Claim[] = [];
  const unplaced: ThreadComment[] = [];
  const others = new Map<number, ThreadComment[]>();
  let section = 0;

  for (const c of comments) {
    const isTop = c.parent === null;
    if (isTop && (c.fromSeller || !sellerKnown)) {
      const lot = sellerLot(c);
      if (lot !== null) {
        used.add(lot);
        lotOfComment.set(c.index, lot);
        labels.set(lot, c.body.split('\n')[0]);
        section = lot;
        continue;
      }
    }

    // Where this comment sits. With nesting in the paste we know; without it, a comment
    // after a lot's comment is read as sitting under that lot.
    const here = c.parent !== null ? lotOfComment.get(c.parent) ?? 0 : nested ? 0 : section;

    const words = spoken(c.body, names);
    const intent = c.fromSeller ? null : intentOf(words);
    if (!intent) {
      if (here > 0) others.set(here, [...(others.get(here) ?? []), c]);
      continue;
    }

    const maxLot = options.maxLot ?? (used.size ? Math.max(...used) : undefined);
    let lots = lotsNamed(words, maxLot);
    if (lots.length === 0 && here > 0) lots = [here];
    if (lots.length === 0) {
      unplaced.push(c);
      continue;
    }
    for (const lot of lots) {
      const claim: Claim = {
        commentIndex: c.index,
        author: c.author,
        lot,
        kind: intent === 'backup' ? 'backup' : 'claim',
        timeHint: c.timeHint,
        section: here,
        text: words,
      };
      (intent === 'release' ? releases : claims).push(claim);
    }
  }

  const byLot = new Map<number, LotClaims>();
  const entry = (lot: number) => {
    let e = byLot.get(lot);
    if (!e) {
      e = { lot, label: labels.get(lot) ?? null, queue: [], tie: null, tieKind: null, released: [], others: others.get(lot) ?? [] };
      byLot.set(lot, e);
    }
    return e;
  };
  for (const lot of used) entry(lot);

  for (const claim of claims) {
    const e = entry(claim.lot);
    if (e.queue.some((q) => norm(q.author) === norm(claim.author))) continue;
    e.queue.push(claim);
  }
  for (const r of releases) {
    const e = entry(r.lot);
    const i = e.queue.findIndex((q) => norm(q.author) === norm(r.author) && q.commentIndex < r.commentIndex);
    if (i >= 0) e.released.push(...e.queue.splice(i, 1));
    else {
      const c = comments[r.commentIndex];
      if (!unplaced.includes(c)) unplaced.push(c);
    }
  }
  unplaced.sort((a, b) => a.index - b.index);

  for (const e of byLot.values()) {
    // A claim beats any "next" behind it, whatever the order they were typed in.
    const primary = e.queue.filter((q) => q.kind === 'claim');
    e.queue = [...primary, ...e.queue.filter((q) => q.kind === 'backup')];
    const firstBySection = new Map<number, Claim>();
    for (const q of primary) if (!firstBySection.has(q.section)) firstBySection.set(q.section, q);
    if (firstBySection.size > 1) {
      e.tie = [...firstBySection.values()].sort((a, b) => a.commentIndex - b.commentIndex);
      e.tieKind = 'thread';
    } else if (primary.length > 1) {
      const key = minuteKey(primary[0].timeHint);
      const same = key ? primary.filter((q) => minuteKey(q.timeHint) === key) : [];
      if (same.length > 1) {
        e.tie = same;
        e.tieKind = 'minute';
      }
    }
  }

  const lots = [...byLot.values()].sort((a, b) => a.lot - b.lot);
  return { comments, lots, unplaced };
}
