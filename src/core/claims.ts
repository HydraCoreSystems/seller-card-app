/**
 * Claim tracker. The seller pastes a sale thread and gets the claims back lot by lot.
 *
 * Claims are always a timestamp call. The order claims arrived is the only order: the first claim wins
 * the lot, and every later claim is an alternate, in the same order. There is no tie, no disputed
 * state, and nothing here lets a seller choose a winner, because a judgment call is playing favorites.
 *
 * Arrival order is read from the times in the paste, down to the second when the paste has them. Two
 * claims that show the same minute still fall in the order they arrived: by their seconds when the
 * paste has seconds, and otherwise by their place in the paste, which is the order the thread was read.
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
  /** Live claims in arrival order, then backups ("next") in arrival order. The first claim wins. */
  queue: Claim[];
  /** Claims the buyer took back later in the thread. */
  released: Claim[];
  /** Everything else said under this lot, for the seller to read. It never changes the order. */
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
export function spoken(body: string, names: string[]): string {
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

export function isConnectorExport(lines: string[]): boolean {
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

/** The line Skrybix puts at the foot of every lot card. It is never a comment and never claim text. */
const ORIGIN_LINE = /^made with skrybix\b/i;
const LOT_ONLY = /^lot\s*#?\s*\d+\s*$/i;

/** A lot card as the app writes it, folded into one seller comment: "Lot 11: Hoya sp. Vietnam $25" and the rest. */
function cardBody(lines: string[]): string {
  const head = lines[0].trim();
  if (!LOT_ONLY.test(head)) return lines.join('\n');
  const rest = lines.slice(1);
  const takeLine = (re: RegExp) => {
    const i = rest.findIndex((l) => re.test(l));
    return i < 0 ? null : rest.splice(i, 1)[0];
  };
  const plant = takeLine(/^plant:/i);
  const price = takeLine(/^(?:price:|auction\b)/i);
  const name = plant ? plant.replace(/^plant:\s*/i, '') : rest.length && !PRICED.test(rest[0]) ? rest.shift() : '';
  const money = price ? price.replace(/^price:\s*/i, '') : '';
  const first = `${head}${name ? `: ${name}` : ''}${money ? ` ${money}` : ''}`;
  return [first, ...rest].join('\n');
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
    // A lot card pasted on its own has no author line. The card is the seller's lot, not a person named "Lot 11".
    if (b.length && lotHeading(b[0]) !== null) {
      out.push({
        index: out.length,
        author: sellerName.trim() || 'Seller',
        body: cardBody(b),
        timeHint: time,
        fromSeller: true,
        parent: null,
      });
      block = [];
      sellerBadge = false;
      return;
    }
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

  // "Lot 12" on its own line opens a card only when card lines follow it. A buyer's bare "Lot 12" does not.
  const opensCard = (at: number) => {
    const next = lines.slice(at + 1).map((l) => l.trim()).filter(Boolean).slice(0, 6);
    return next.some((l) => ORIGIN_LINE.test(l) || /^(?:plant|price):/i.test(l));
  };

  for (const [at, raw] of lines.entries()) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (NOISE.some((r) => r.test(trimmed))) continue;
    if (ORIGIN_LINE.test(trimmed)) {
      // The foot of a lot card. It closes the card, so whatever follows is a new comment.
      const cardAt = block.findIndex((l) => lotHeading(l) !== null);
      if (cardAt === 0 || (cardAt === 1 && block.length > 1)) flush(null);
      continue;
    }
    const meta = isMetaLine(trimmed);
    if (meta.meta) {
      if (block.length) flush(meta.time);
      else if (meta.time && out.length && out[out.length - 1].timeHint === null) {
        out[out.length - 1].timeHint = meta.time;
      }
      continue;
    }
    // A line that is only "Lot 12" opens a lot card, so whatever came before it is finished.
    if (LOT_ONLY.test(trimmed) && block.length && opensCard(at)) flush(null);
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

/** The time written on claims that came from screenshots, so a pasted export can still be read back. */
export const SCREENSHOT_TIME = 'screenshot';

/** "1:29:16 PM" for exact times; anything else as it came. */
export function showTime(hint: string | null): string | null {
  // Claims read from screenshots carry no time. Their place in the screenshots is their order.
  if (!hint || hint === SCREENSHOT_TIME) return null;
  const iso = hint.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):(\d{2})/);
  if (!iso) return hint;
  const h = Number(iso[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${iso[2]}:${iso[3]} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** When a claim arrived, as milliseconds, when its time is exact. */
function exactMs(hint: string | null): number | null {
  if (!hint || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(hint)) return null;
  const ms = Date.parse(hint);
  return Number.isNaN(ms) ? null : ms;
}

/** How long ago a claim was made, in minutes, from a hint like "5m", "2h" or "just now". */
function ageMinutes(hint: string | null): number | null {
  if (!hint) return null;
  const h = hint.trim().toLowerCase();
  if (h === 'just now') return 0;
  const m = h.match(/^(\d+)\s?(s|m|min|mins|h|hr|hrs|d|w)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === 's' ? n / 60 : m[2].startsWith('m') ? n : m[2].startsWith('h') ? n * 60 : m[2] === 'd' ? n * 1440 : n * 10080;
}

/**
 * The one ordering rule for claims: earliest arrival first. Exact times decide by the second. Ages like
 * "5m" decide when they differ, the older claim first. Anything still equal, or with no usable time, falls
 * to the place in the paste. It never returns zero for two different comments, so no two claims tie.
 */
export function arrivedBefore(a: Claim, b: Claim): number {
  const ta = exactMs(a.timeHint);
  const tb = exactMs(b.timeHint);
  if (ta !== null && tb !== null && ta !== tb) return ta - tb;
  const aa = ageMinutes(a.timeHint);
  const ab = ageMinutes(b.timeHint);
  if (ta === null && tb === null && aa !== null && ab !== null && aa !== ab) return ab - aa;
  return a.commentIndex - b.commentIndex;
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

/**
 * Facebook's copy puts the name of the person being replied to in front of the reply, so "Dee Bradshaw" over
 * "Phil Achleman sold please" is Dee saying "sold please". A name that is known comes off first. Failing
 * that, two or three capitalized words with no claim words in them, ahead of words that do claim, are a name.
 */
export function withoutReplyName(words: string, known: string[]): string {
  const lower = words.toLowerCase();
  for (const n of known) {
    const k = n.trim().toLowerCase();
    if (k && lower.startsWith(`${k} `) && words.slice(k.length).trim()) return words.slice(k.length).trim();
  }
  const m = words.match(/^((?:[A-Z][A-Za-z'’.-]*\s+){1,2}[A-Z][A-Za-z'’.-]*)\s+(\S[\s\S]*)$/);
  if (!m) return words;
  const [, name, rest] = m;
  if (/\blot\b/i.test(name) || intentOf(name) !== null || intentOf(rest) === null) return words;
  return rest.trim();
}

export function trackClaims(text: string, options: ClaimOptions = {}): ClaimReport {
  return trackComments(parseThread(text, options.sellerName ?? ''), options);
}

/** The claim logic itself, for comments that are already split. Every way of bringing a thread in ends up here. */
export function trackComments(comments: ThreadComment[], options: ClaimOptions = {}): ClaimReport {
  const sellerKnown = comments.some((c) => c.fromSeller);
  const nested = comments.some((c) => c.parent !== null);
  const names = [...new Set(comments.map((c) => c.author))].sort((a, b) => b.length - a.length);

  const replyNames = options.sellerName ? [...names, options.sellerName] : names;

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

    const words = withoutReplyName(spoken(c.body, names), replyNames);
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
      e = { lot, label: labels.get(lot) ?? null, queue: [], released: [], others: others.get(lot) ?? [] };
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
    // A claim beats any "next" behind it. Each group runs in the order its claims arrived.
    const primary = e.queue.filter((q) => q.kind === 'claim').sort(arrivedBefore);
    e.queue = [...primary, ...e.queue.filter((q) => q.kind === 'backup').sort(arrivedBefore)];
  }

  const lots = [...byLot.values()].sort((a, b) => a.lot - b.lot);
  return { comments, lots, unplaced };
}
