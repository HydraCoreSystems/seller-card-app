/**
 * The buyer checkout chain (Pro). After a sale closes, every winner fills one short form that lives
 * in the seller's own Google account. The responses come back as a sheet the seller imports, get
 * matched to winners by Facebook name, and feed the rundown, the packing view and the label export.
 *
 * Nothing here talks to a server. Forms, sheets and exports stay on the seller's phone and in the
 * seller's own Google account.
 */
import { SHOWCASE } from './brand';
import { buyerKey, firstName } from './buyers';
import { flatShipping } from './chase';
import type { RundownBuyer } from './rundown';
import { formatDeadline, runnerUp, type ChanceCard } from './secondChance';
import { MONTHS, formatDay, formatPrice, formatSaleTime, joinLines, parseDay } from './text';
import type { CheckoutResponse, Fulfillment, Profile, Sale, SaleRecord, SaleTime } from './types';
import { DEFAULT_CONTACT_HOURS } from './venues';

/* ---------- the buyer contact deadline ---------- */

/** When the sale ends: an auction's close, or a set price sale's end time. Null when the seller hasn't said. */
export function saleEnd(sale: Pick<Sale, 'kind' | 'closes' | 'endsAt'>): SaleTime | null {
  return (sale.kind === 'auction' ? sale.closes : sale.endsAt) ?? null;
}

export function contactHoursOf(sale: Pick<Sale, 'contactHours'>, profile: Pick<Profile, 'contactHours'>): number {
  const h = sale.contactHours ?? profile.contactHours ?? DEFAULT_CONTACT_HOURS;
  return h > 0 ? h : DEFAULT_CONTACT_HOURS;
}

/** A calendar day and clock time moved forward by whole hours, with no time zone in it. */
export function addHours(t: SaleTime, hours: number): SaleTime {
  const { y, m, d } = parseDay(t.day);
  const [hh, mm] = t.time.split(':').map(Number);
  const moved = new Date(Date.UTC(y, m - 1, d, hh + hours, mm));
  const day = `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}-${String(moved.getUTCDate()).padStart(2, '0')}`;
  return { day, time: `${String(moved.getUTCHours()).padStart(2, '0')}:${String(moved.getUTCMinutes()).padStart(2, '0')}` };
}

/** A sale time as milliseconds on this phone's clock. */
export function saleTimeMs(t: SaleTime): number {
  const { y, m, d } = parseDay(t.day);
  const [hh, mm] = t.time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}

const hoursWord = (n: number) => `${n} ${n === 1 ? 'hour' : 'hours'}`;

/** The deadline as a real clock time, like "Monday, November 2 at 8:00 PM Eastern". Null until the sale's end is known. */
export function contactDeadlineText(sale: Sale, profile: Profile): string | null {
  const end = saleEnd(sale);
  return end ? formatSaleTime(addHours(end, contactHoursOf(sale, profile)), profile.timeZone) : null;
}

/**
 * The rule almost every purge prints in the main post. With the sale's end time known it names the
 * clock time; without it, it says so in words and the app tells the seller the clock time is missing.
 */
export function contactLine(sale: Sale, profile: Profile): string {
  const hours = hoursWord(contactHoursOf(sale, profile));
  const by = contactDeadlineText(sale, profile);
  return by
    ? `Message me within ${hours} of the sale ending, by ${by}, to arrange payment and shipping or pickup. If I don't hear from you by then, the plant goes to the next in line.`
    : `Message me within ${hours} of the sale ending to arrange payment and shipping or pickup. If I don't hear from you, the plant goes to the next in line.`;
}

export type DeadlineState =
  | { state: 'none' }
  | { state: 'open'; ms: number; hoursLeft: number }
  | { state: 'passed'; ms: number };

/**
 * Where the deadline stands. It runs from the sale's end time; a sale with none falls back to the
 * moment the seller closed it in the app. No end and not closed means there is no deadline yet.
 */
export function deadlineState(sale: Sale, profile: Profile, now: number): DeadlineState {
  const end = saleEnd(sale);
  const startMs = end ? saleTimeMs(end) : sale.closedMs ?? null;
  if (startMs === null) return { state: 'none' };
  const ms = startMs + contactHoursOf(sale, profile) * 3_600_000;
  return now >= ms ? { state: 'passed', ms } : { state: 'open', ms, hoursLeft: Math.ceil((ms - now) / 3_600_000) };
}

/* ---------- the standing form ---------- */

/** The word the app tags a link with, and the word a seller types into the sale name box when they make the prefilled link by hand. */
export const FORM_TOKEN = 'SKRYBSALE';

/**
 * The word links carried before the app was renamed. It is only ever read, never written: a link a
 * seller saved with it keeps swapping in each sale's name, and everything the app produces uses FORM_TOKEN.
 */
export const LEGACY_FORM_TOKEN = 'SPRIGSALE';

const FORM_TOKENS: readonly string[] = [FORM_TOKEN, LEGACY_FORM_TOKEN];

/** What the form calls this sale, so responses arrive tagged by sale. */
export function saleName(sale: Pick<Sale, 'name' | 'opens' | 'createdAt'>, profile: Pick<Profile, 'venueName'>): string {
  const typed = sale.name?.trim();
  if (typed) return typed;
  const day = sale.opens?.day ?? sale.createdAt;
  const { m, d } = parseDay(day);
  return `${profile.venueName?.trim() || SHOWCASE} ${MONTHS[m - 1]} ${d}`;
}

export interface PrefilledLink {
  /** The link to share for this sale, or null when the pasted link can't be used. */
  url: string | null;
  /** True when the link carries the sale name, so responses arrive tagged by sale. */
  tagged: boolean;
  /** Plain words about what's wrong or missing. Null when all is well. */
  problem: string | null;
}

const ENTRY = /([?&])(entry\.\d+)=([^&#]*)/g;

/**
 * The seller's pasted form link with this sale's name filled in. The seller makes the link once with
 * Google Forms' own Get prefilled link, typing SKRYBSALE in the sale name box; each sale swaps that
 * word for the sale's name. Links saved with the old word SPRIGSALE work the same. A link with one
 * prefilled box and neither word gets that box filled.
 */
export function prefilledLink(link: string, name: string): PrefilledLink {
  const raw = link.trim();
  if (!raw) return { url: null, tagged: false, problem: 'Paste your checkout form link in this room’s profile first.' };
  if (/^(https?:\/\/)?forms\.gle\//i.test(raw)) {
    return {
      url: null,
      tagged: false,
      problem: 'A short forms.gle link can’t carry the sale name. Open your form in a browser and paste the long link from the address bar.',
    };
  }
  if (!/^https:\/\/docs\.google\.com\/forms\//i.test(raw)) {
    return { url: null, tagged: false, problem: 'That doesn’t look like a Google Forms link.' };
  }
  if (/\/edit(\?|#|$)/i.test(raw)) {
    return { url: null, tagged: false, problem: 'That’s the link for editing your form. Use the link buyers open, which ends in viewform.' };
  }
  const entries = [...raw.matchAll(ENTRY)];
  const withToken = entries.filter((e) => FORM_TOKENS.includes(safeDecode(e[3])));
  const chosen = withToken.length ? withToken : entries.length === 1 ? entries : [];
  if (!chosen.length) {
    return {
      url: raw,
      tagged: false,
      problem: `This link has no prefilled sale name box, so responses won’t say which sale they’re for. Make a prefilled link and type ${FORM_TOKEN} in the sale name box.`,
    };
  }
  const target = chosen[0][2];
  const url = raw.replace(ENTRY, (whole, sep: string, key: string) => (key === target ? `${sep}${key}=${encodeURIComponent(name)}` : whole));
  return { url, tagged: true, problem: null };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

/**
 * True for the plain link buyers open, the one Google Forms' Send button gives: a viewform link with
 * no prefilled boxes yet. This is the one kind of link the app tries to tag by itself.
 */
export function isPlainFormLink(link: string): boolean {
  const raw = link.trim();
  if (!/^https:\/\/docs\.google\.com\/forms\/d\/(e\/)?[\w-]+\/viewform([?#].*)?$/i.test(raw)) return false;
  return ![...raw.matchAll(ENTRY)].length;
}

/** The plain link with the Sale name box prefilled with the token, ready for each sale to swap its own name in. */
export function taggedFormLink(link: string, entryId: string): string {
  const base = link.trim().split(/[?#]/)[0];
  return `${base}?usp=pp_url&entry.${entryId}=${FORM_TOKEN}`;
}

/**
 * The Sale name question's box id, read from the form page's own data. A Google Form page carries its
 * questions in a script as FB_PUBLIC_LOAD_DATA_: a list of items, each with its title and, in slot 4,
 * the answer box whose first value is the id that prefilled links use as entry.ID. The template's
 * first question is called Sale name. Null when the page isn't a form page or has no such question,
 * so the caller can fall back to the manual route.
 */
export function saleEntryFromFormHtml(html: string): string | null {
  const at = html.indexOf('FB_PUBLIC_LOAD_DATA_');
  if (at < 0) return null;
  const start = html.indexOf('[', at);
  const close = html.indexOf('</script>', start);
  if (start < 0 || close < 0) return null;
  let data: unknown;
  try {
    data = JSON.parse(html.slice(start, close).trim().replace(/;$/, ''));
  } catch {
    return null;
  }
  const items = Array.isArray(data) && Array.isArray(data[1]) ? data[1][1] : null;
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (!Array.isArray(item) || typeof item[1] !== 'string' || !/^sale\b/i.test(item[1].trim())) continue;
    const id = Array.isArray(item[4]) && Array.isArray(item[4][0]) ? item[4][0][0] : null;
    if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) return String(id);
  }
  return null;
}

/** The payment choices for the form's payment question, from the room's own payment lines. */
export function paymentChoices(payment: string): string[] {
  const text = payment.trim();
  if (!text) return [];
  const parts = /\n/.test(text) ? text.split(/\n+/) : text.split(/[,;]+/);
  return [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
}

export interface FormField {
  label: string;
  /** How the question is set up in Google Forms. */
  setup: string;
}

/**
 * The form, field for field. The sale name comes first and Shipped or local pickup comes right after
 * the email, ahead of the address boxes: a Google Form can only skip questions that come after the
 * answer, so the pickup choice has to come first for pickup to skip the address.
 */
export function formFields(profile: Pick<Profile, 'payment'>): FormField[] {
  const choices = paymentChoices(profile.payment);
  return [
    { label: 'Sale name', setup: 'Short answer, required. The pre-filled link fills it in for each sale.' },
    { label: 'Buyer Facebook name', setup: 'Short answer, required. Ask for it exactly as it appears on their claim.' },
    { label: 'Email', setup: 'Short answer, required.' },
    { label: 'Shipped or local pickup', setup: 'Multiple choice, required: Shipped, Local pickup. Local pickup goes straight to the payment question.' },
    { label: 'Ship to name', setup: 'Short answer, required. Starts a new section that only Shipped sees.' },
    { label: 'Street address', setup: 'Short answer, required.' },
    { label: 'City', setup: 'Short answer, required.' },
    { label: 'State', setup: 'Short answer, required.' },
    { label: 'ZIP code', setup: 'Short answer, required.' },
    {
      label: 'Payment method they will use',
      setup: choices.length
        ? `Multiple choice, required: ${choices.join(', ')}. Starts a new section both answers reach.`
        : 'Multiple choice, required. Add your payment methods in this room’s profile first, then copy them in. Starts a new section both answers reach.',
    },
    { label: 'Note', setup: 'Paragraph, optional.' },
  ];
}

/**
 * The seller's closeout comment for the main listing post. It never carries the checkout form link,
 * and it never mentions a form: the app knows who won, and the form goes to each winner personally,
 * in winnerMessage and formReminder. This comment only says thank you and tells winners to watch
 * for a message from the seller.
 */
export function closeoutComment(sale: Sale, profile: Profile): string {
  const by = contactDeadlineText(sale, profile);
  return joinLines([
    `${sale.kind === 'auction' ? 'The auction is closed' : 'The sale is closed'}. Thank you, everyone! Winners, watch for a message from me. I’ll send each of you your lots, your total and what I need from you.`,
    '',
    by ? `Please answer me by ${by}. If I don’t hear from you by then, the plant goes to the next in line.` : 'If I don’t hear from you, the plant goes to the next in line.',
  ]);
}

/** The personal message to one winner: their lots, their total, the form and the deadline. */
export function winnerMessage(row: Pick<CheckoutRow, 'buyer' | 'lots' | 'plantsTotal' | 'shippingCharge' | 'totalKnown' | 'totalOwed'>, sale: Sale, profile: Profile, formUrl: string, deadlineMsAt: number | null): string {
  const lots = row.lots.map((l) => `Lot ${l.number}, ${l.name}${l.price !== null ? `, ${formatPrice(l.price)}` : ''}`);
  const total = row.totalKnown
    ? row.shippingCharge ? `Your total with shipping is ${formatPrice(row.totalOwed)}.` : `Your total is ${formatPrice(row.totalOwed)}.`
    : `Your plants come to ${formatPrice(row.plantsTotal)}, plus shipping.`;
  return joinLines([
    `Hi ${firstName(row.buyer)}! Congratulations, you won in my ${SHOWCASE} on ${formatDay(sale.opens?.day ?? sale.createdAt)}.`,
    '',
    ...lots,
    '',
    total,
    '',
    `Please fill in this short form with your shipping details and how you’ll pay: ${formUrl}`,
    deadlineMsAt !== null ? `I need it by ${formatDeadline(deadlineMsAt, profile.timeZone)}, or your plants go to the next in line.` : null,
  ]);
}

/** A reminder to a winner who hasn't sent the form. */
export function formReminder(row: Pick<CheckoutRow, 'buyer' | 'lots'>, profile: Profile, formUrl: string, deadlineMsAt: number | null): string {
  return joinLines([
    `Hi ${firstName(row.buyer)}! I haven’t gotten your checkout form yet for ${row.lots.map((l) => `lot ${l.number}`).join(', ')}.`,
    `Here’s the link: ${formUrl}`,
    deadlineMsAt !== null ? `Please send it by ${formatDeadline(deadlineMsAt, profile.timeZone)}.` : null,
    'Thank you!',
  ]);
}

/* ---------- reading the responses ---------- */

type FieldKey = keyof Omit<CheckoutResponse, 'row' | 'pickup'> | 'delivery';

/** Header patterns, tried in this order so "Email address" is an email and "Ship to name" isn't the shipping choice. */
const HEADER_PATTERNS: [FieldKey, RegExp][] = [
  ['timestamp', /timestamp/],
  ['email', /e-?mail/],
  ['facebookName', /facebook|\bfb\b/],
  ['shipToName', /ship\s*to|recipient/],
  ['saleName', /^sale/],
  ['zip', /\bzip|postal/],
  ['city', /^city/],
  ['state', /^state/],
  ['street', /street|address/],
  ['delivery', /pick\s*up|shipped\s*or/],
  ['paymentMethod', /payment|pay with|pay by/],
  ['note', /note|comment/],
];

export type ResponsesRead =
  | { ok: true; responses: CheckoutResponse[]; saleColumn: boolean }
  | { ok: false; error: string };

/** Reads a checkout sheet: the first row names the columns, one response per row after it. */
export function readResponses(rows: string[][]): ResponsesRead {
  const header = rows[0]?.map((h) => h.trim().toLowerCase().replace(/\s+/g, ' '));
  if (!header || header.every((h) => !h)) return { ok: false, error: 'That sheet is empty.' };
  const col = new Map<FieldKey, number>();
  header.forEach((h, i) => {
    if (!h) return;
    for (const [key, pattern] of HEADER_PATTERNS) {
      if (pattern.test(h) && !col.has(key)) {
        col.set(key, i);
        return;
      }
    }
  });
  if (!col.has('facebookName')) {
    return { ok: false, error: 'I couldn’t find a Facebook name column. This should be the sheet your checkout form fills in.' };
  }
  const at = (row: string[], key: FieldKey) => (col.has(key) ? (row[col.get(key)!] ?? '').trim() : '');
  const responses: CheckoutResponse[] = [];
  rows.slice(1).forEach((row, i) => {
    if (row.every((c) => !c?.trim())) return;
    responses.push({
      row: i + 2,
      timestamp: at(row, 'timestamp'),
      saleName: at(row, 'saleName'),
      facebookName: at(row, 'facebookName'),
      email: at(row, 'email'),
      shipToName: at(row, 'shipToName'),
      street: at(row, 'street'),
      city: at(row, 'city'),
      state: at(row, 'state'),
      zip: at(row, 'zip'),
      pickup: /pick\s*up/i.test(at(row, 'delivery')),
      paymentMethod: at(row, 'paymentMethod'),
      note: at(row, 'note'),
    });
  });
  return { ok: true, responses, saleColumn: col.has('saleName') };
}

/* ---------- matching to winners ---------- */

export interface MatchResult {
  /** The response that counts for each winner, by buyerKey. The latest one wins when a buyer sent two. */
  matched: Map<string, CheckoutResponse>;
  /** Responses whose Facebook name matches no winner. Never merged, never guessed at. */
  unmatched: CheckoutResponse[];
  /** Responses tagged for a different sale. */
  otherSale: CheckoutResponse[];
  /** Earlier responses from a buyer who sent the form again. */
  superseded: CheckoutResponse[];
}

const nameKey = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Matches each response to a winner by Facebook name, the way claims are matched: case, spacing and
 * punctuation set aside, nothing else. A name that matches no winner is set aside for the seller. A
 * seller can pair one by hand (links: response row to buyer key); that is the seller's call, not ours.
 */
export function matchResponses(
  responses: CheckoutResponse[],
  winners: string[],
  thisSale: string,
  links: Record<number, string> = {},
): MatchResult {
  const winnerKeys = new Set(winners.map(buyerKey).filter(Boolean));
  const out: MatchResult = { matched: new Map(), unmatched: [], otherSale: [], superseded: [] };
  for (const r of responses) {
    if (r.saleName.trim() && nameKey(r.saleName) !== nameKey(thisSale)) {
      out.otherSale.push(r);
      continue;
    }
    const linked = links[r.row];
    const key = linked && winnerKeys.has(linked) ? linked : buyerKey(r.facebookName);
    if (!key || !winnerKeys.has(key)) {
      out.unmatched.push(r);
      continue;
    }
    const earlier = out.matched.get(key);
    if (earlier) out.superseded.push(earlier);
    out.matched.set(key, r);
  }
  return out;
}

/* ---------- one row per winner ---------- */

export type Stage = 'won' | 'contacted' | 'paid' | 'shipped';
export type ContactState = 'in' | 'waiting' | 'late';

export interface CheckoutRow {
  buyer: string;
  key: string;
  lots: { number: number; name: string; price: number | null }[];
  plantsTotal: number;
  /** What shipping adds: zero for pickup, the room's flat amount, or what the seller typed. Null when it's tiered and unset. */
  shippingCharge: number | null;
  /** The room's own shipping words, for a buyer whose shipping can't be added up. */
  shippingNote: string | null;
  /** Plants plus shipping when shipping is known; plants alone when it isn't. */
  totalOwed: number;
  totalKnown: boolean;
  response: CheckoutResponse | null;
  contacted: boolean;
  paid: boolean;
  neverPaid: boolean;
  shipped: boolean;
  packed: boolean;
  tracking: string;
  pickup: boolean;
  /** What the buyer said they'd pay with, as the form recorded it. */
  intendedMethod: string;
  /** What the seller says they paid with. */
  paidVia: string;
  /** True only when both are filled in and they differ, so a mismatch is never a guess. */
  methodMismatch: boolean;
  stage: Stage;
  contactState: ContactState;
  weightOz: number | null;
}

export function buildCheckoutRows({
  buyers,
  match,
  fulfillment,
  profile,
  deadline,
}: {
  buyers: RundownBuyer[];
  match: MatchResult;
  fulfillment: Record<string, Fulfillment> | undefined;
  profile: Profile;
  deadline: DeadlineState;
}): CheckoutRow[] {
  const flat = flatShipping(profile.shipping);
  return buyers.map((b) => {
    const key = buyerKey(b.name);
    const response = match.matched.get(key) ?? null;
    const f = fulfillment?.[key] ?? {};
    const pickup = response?.pickup ?? false;
    const override = f.shippingCharge ?? null;
    const shippingCharge = pickup ? 0 : override !== null ? override : flat;
    const paid = b.payment === 'paid';
    const shipped = !!f.shipped;
    const contacted = !!response;
    const intendedMethod = response?.paymentMethod ?? '';
    const paidVia = f.paidVia?.trim() ?? '';
    return {
      buyer: b.name,
      key,
      lots: b.lots,
      plantsTotal: b.total,
      shippingCharge,
      shippingNote: shippingCharge === null ? profile.shipping.trim() || null : null,
      totalOwed: b.total + (shippingCharge ?? 0),
      totalKnown: shippingCharge !== null,
      response,
      contacted,
      paid,
      neverPaid: b.payment === 'never',
      shipped,
      packed: !!f.packed,
      tracking: f.tracking?.trim() ?? '',
      pickup,
      intendedMethod,
      paidVia,
      methodMismatch: !!intendedMethod && !!paidVia && nameKey(intendedMethod) !== nameKey(paidVia),
      stage: shipped ? 'shipped' : paid ? 'paid' : contacted ? 'contacted' : 'won',
      contactState: contacted ? 'in' : deadline.state === 'passed' ? 'late' : 'waiting',
      weightOz: f.weightOz ?? profile.weightOz ?? null,
    };
  });
}

/**
 * Winners with no form once the deadline has passed. Anyone already marked paid or never paid is
 * left off: a buyer who paid is a payment to chase up for an address, not a lot to offer on.
 */
export function noContactList(rows: CheckoutRow[], deadline: DeadlineState): CheckoutRow[] {
  if (deadline.state !== 'passed') return [];
  return rows.filter((r) => !r.contacted && !r.paid && !r.neverPaid);
}

/** Winners who paid but never sent the form: the seller still has no address for them. */
export function paidNoForm(rows: CheckoutRow[]): CheckoutRow[] {
  return rows.filter((r) => r.paid && !r.contacted);
}

/**
 * Second Chance cards for the no contact list: each lot a no contact winner holds, offered to the
 * next in line. Lots already offered, or already sent back to open, are left to the existing cards.
 */
export function noContactChances(sale: Sale, rows: CheckoutRow[], records: SaleRecord[], deadline: DeadlineState): ChanceCard[] {
  if (deadline.state !== 'passed') return [];
  const cards: ChanceCard[] = [];
  for (const row of rows) {
    for (const lot of row.lots) {
      if (sale.offers?.some((o) => o.lot === lot.number)) continue;
      cards.push({ lot: lot.number, name: lot.name, price: lot.price, buyer: row.buyer, runnerUp: runnerUp(sale, lot.number, records), kind: 'nocontact', dueMs: deadline.ms });
    }
  }
  return cards.sort((a, b) => a.lot - b.lot);
}

/** The existing cards with the no contact cards laid over them: a lot shows once, as no contact. */
export function mergeChances(base: ChanceCard[], noContact: ChanceCard[]): ChanceCard[] {
  const taken = new Set(noContact.map((c) => c.lot));
  return [...base.filter((c) => !taken.has(c.lot)), ...noContact].sort((a, b) => a.lot - b.lot);
}

/* ---------- the packing view ---------- */

/** Rows the packing view works from: matched, paid, and not passed on. */
export function packingRows(rows: CheckoutRow[]): CheckoutRow[] {
  return rows.filter((r) => r.paid && r.contacted && !r.neverPaid);
}

/** The ship to address exactly as the buyer typed it: their name, street, then city, state and ZIP. */
export function addressLines(r: CheckoutResponse): string[] {
  const cityLine = [r.city, [r.state, r.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [r.shipToName || r.facebookName, r.street, cityLine].filter(Boolean);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The printable packing list: one block per buyer with room to check off each box. */
export function packingListHtml(rows: CheckoutRow[], title: string, profile: Pick<Profile, 'shipping'>): string {
  const method = profile.shipping.trim();
  const blocks = rows
    .map((r) => {
      const where = r.pickup ? '<b>Local pickup</b>' : r.response ? addressLines(r.response).map(esc).join('<br>') : '';
      const how = r.pickup ? 'Local pickup' : method || 'Shipping';
      return `<div class="b"><div class="h"><b>${esc(r.buyer)}</b><span class="soft">${esc(how)}</span></div>
<ul>${r.lots.map((l) => `<li>Lot ${l.number}, ${esc(l.name)}</li>`).join('')}</ul>
<div class="addr">${where}</div>
<div class="box">Box 1 &#9744; &nbsp; Box 2 &#9744; &nbsp; Box 3 &#9744;</div></div>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font-family:Helvetica,Arial,sans-serif;color:#1F2A1F;margin:28px;font-size:13px;line-height:1.4}
h1{font-size:20px;margin:0 0 12px}.b{border:1px solid #DCD8CC;border-radius:8px;padding:10px 12px;margin-bottom:10px;page-break-inside:avoid}
.h{display:flex;justify-content:space-between;font-size:15px}.soft{color:#5E6B5E}ul{margin:6px 0;padding-left:18px}
.addr{margin:6px 0}.box{margin-top:8px;font-size:15px}
</style></head><body><h1>${esc(title)}</h1>${blocks || '<p class="soft">Nothing to pack yet. A buyer shows up here once their form is in and you mark them paid.</p>'}</body></html>`;
}

/* ---------- the label export ---------- */

/** Pirate Ship has no fixed column names: it asks you to match columns the first time you upload a file. */
export const LABEL_HEADERS = ['Name', 'Address Line 1', 'City', 'State', 'Zip', 'Weight (oz)'] as const;

/** Why a row can't go in the label file, or null when it can. An unpaid row never can. */
export function labelProblem(r: CheckoutRow): string | null {
  if (!r.paid || r.neverPaid) return 'Not marked paid';
  if (!r.response) return 'No checkout form yet';
  if (r.pickup) return 'Local pickup, no label needed';
  const missing = [
    !(r.response.shipToName || r.response.facebookName) && 'name',
    !r.response.street && 'street',
    !r.response.city && 'city',
    !r.response.state && 'state',
    !r.response.zip && 'ZIP',
  ].filter(Boolean);
  return missing.length ? `Address is missing the ${missing.join(', ')}` : null;
}

/** A cell for a spreadsheet file. Text a buyer typed that a spreadsheet would run as a formula is set off with a space. */
function csvCell(value: string): string {
  const safe = /^[=+@-]/.test(value) ? ` ${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export interface LabelFile {
  csv: string;
  included: CheckoutRow[];
  skipped: { buyer: string; reason: string }[];
  /** Rows going out with no weight, which Pirate Ship fills from the default package details at upload. */
  noWeight: number;
}

/**
 * The CSV for Pirate Ship's batch upload. Every row is checked here, whoever calls: a row that isn't
 * marked paid can't enter the file, and it comes back in skipped with the reason.
 */
export function buildLabelFile(rows: CheckoutRow[]): LabelFile {
  const included: CheckoutRow[] = [];
  const skipped: LabelFile['skipped'] = [];
  for (const r of rows) {
    const problem = labelProblem(r);
    if (problem) skipped.push({ buyer: r.buyer, reason: problem });
    else included.push(r);
  }
  const lines = [
    LABEL_HEADERS.map(csvCell).join(','),
    ...included.map((r) => {
      const a = r.response!;
      return [a.shipToName || a.facebookName, a.street, a.city, a.state, a.zip, r.weightOz === null ? '' : String(r.weightOz)].map(csvCell).join(',');
    }),
  ];
  return { csv: lines.join('\r\n') + '\r\n', included, skipped, noWeight: included.filter((r) => r.weightOz === null).length };
}

/** The message that tells a buyer their plants shipped, with the tracking number the seller pasted in. */
export function shippedMessage(r: Pick<CheckoutRow, 'buyer' | 'lots' | 'tracking'>): string {
  return joinLines([
    `Hi ${firstName(r.buyer)}! Your plants shipped.`,
    '',
    ...r.lots.map((l) => `Lot ${l.number}, ${l.name}`),
    '',
    r.tracking ? `Tracking number: ${r.tracking}` : null,
    'Please let me know when they arrive. Thank you!',
  ]);
}

/** The profile a payment reminder reads its shipping line from: no shipping for pickup, the typed amount for a tiered room. */
export function profileForReminder(row: Pick<CheckoutRow, 'pickup' | 'shippingCharge'>, room: Profile): Profile {
  if (row.pickup) return { ...room, shipping: '' };
  if (row.shippingCharge !== null && flatShipping(room.shipping) === null) return { ...room, shipping: `$${row.shippingCharge} flat` };
  return room;
}
