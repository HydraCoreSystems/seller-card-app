/**
 * After sale rundown. Reads the claim report against the sale and the seller's own rulings,
 * and gives back who won each lot, who's next in line, what each buyer owes, and anything
 * a buyer asked that the seller should answer. The Sales Record document is printed from it.
 */
import { ORIGIN_LINE, SHOWCASE } from './brand';
import { buyerHistory, buyerKey as key, type BuyerHistory } from './buyers';
import type { ClaimReport, ThreadComment } from './claims';
import { cleanMentions, showTime, spoken } from './claims';
import { COMMONS_MARKET } from './formats/commons';
import { shippingLine } from './formats/parts';
import { formatLongDate, formatPrice, plantDisplayName } from './text';
import type { FormatId, Lot, Profile, Sale, SaleRecord } from './types';

export interface RundownLot {
  number: number;
  name: string;
  price: number | null;
  /** The seller's ruling when there is one, otherwise the clear first claim. */
  winner: string | null;
  /** True when the seller has marked this lot sold. */
  ruled: boolean;
  /** Claims tied for first that the seller hasn't ruled on yet. */
  tie: string[] | null;
  /** Everyone still waiting behind the winner, in thread order. */
  line: string[];
}

export interface RundownBuyer {
  name: string;
  lots: { number: number; name: string; price: number | null }[];
  total: number;
  /** What they bought in other sales. Set only for repeat buyers. */
  history: BuyerHistory | null;
  /** Paid when every lot is marked paid, never when any is marked never paid. */
  payment: 'paid' | 'never' | null;
}

export interface OpenQuestion {
  author: string;
  text: string;
  /** The lot it was asked under, or null when it sits in the open thread. */
  lot: number | null;
  time: string | null;
}

export interface Rundown {
  /** YYYY-MM-DD */
  day: string;
  sellerName: string;
  /** The showcase's format, so the record carries the room's heading only in the room's format. */
  formatId: FormatId;
  lotsOffered: number;
  lotsClaimed: number;
  claimedValue: number;
  shipping: string | null;
  payment: string | null;
  lots: RundownLot[];
  buyers: RundownBuyer[];
  questions: OpenQuestion[];
}

/** "$15" out of a lot comment like "Hoya polyneura $15". */
export function priceIn(label: string | null | undefined): number | null {
  const m = label?.match(/\$\s?(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}

function nameIn(label: string): string {
  return label.replace(/\s*\$\s?\d+(?:\.\d{1,2})?\s*$/, '').trim() || label;
}

export function buildRundown({
  sale,
  profile,
  report,
  records,
}: {
  sale: Sale;
  profile: Profile;
  report: ClaimReport | null;
  records: SaleRecord[];
}): Rundown {
  const numbers = new Set([...sale.lots.map((l) => l.number), ...(report?.lots.map((l) => l.lot) ?? [])]);
  const lots: RundownLot[] = [...numbers]
    .sort((a, b) => a - b)
    .map((number) => {
      const lot = sale.lots.find((l) => l.number === number);
      const claims = report?.lots.find((l) => l.lot === number);
      const record = records.find((r) => r.saleId === sale.id && r.lotNumber === number);
      const queue = claims?.queue.map((c) => c.author) ?? [];
      const name = lot
        ? plantDisplayName(lot.name, lot.noid)
        : record?.plantName ?? (claims?.label ? nameIn(claims.label) : `Lot ${number}`);
      const price = record?.price ?? lot?.price ?? priceIn(claims?.label);

      if (record) {
        return { number, name, price, winner: record.buyer, ruled: true, tie: null, line: queue.filter((a) => key(a) !== key(record.buyer)) };
      }
      if (claims?.tie) {
        const tied = claims.tie.map((c) => c.author);
        return { number, name, price, winner: null, ruled: false, tie: tied, line: queue.filter((a) => !tied.includes(a)) };
      }
      return { number, name, price, winner: queue[0] ?? null, ruled: false, tie: null, line: queue.slice(1) };
    });

  const claimed = lots.filter((l) => l.winner || l.tie);
  const past = buyerHistory(records, sale.id);
  const mine = records.filter((r) => r.saleId === sale.id);
  const byBuyer = new Map<string, RundownBuyer>();
  for (const l of lots) {
    if (!l.winner) continue;
    const k = key(l.winner);
    const b = byBuyer.get(k) ?? { name: l.winner, lots: [], total: 0, history: past.get(k) ?? null, payment: null };
    b.lots.push({ number: l.number, name: l.name, price: l.price });
    b.total += l.price ?? 0;
    byBuyer.set(k, b);
  }
  for (const [k, b] of byBuyer) {
    const recs = mine.filter((r) => key(r.buyer) === k);
    b.payment = recs.some((r) => r.payment === 'never')
      ? 'never'
      : recs.length === b.lots.length && recs.every((r) => r.payment === 'paid')
        ? 'paid'
        : null;
  }

  return {
    day: sale.opens?.day ?? sale.createdAt,
    sellerName: profile.sellerName.trim(),
    formatId: sale.formatId,
    lotsOffered: lots.length,
    lotsClaimed: claimed.length,
    claimedValue: claimed.reduce((sum, l) => sum + (l.price ?? 0), 0),
    shipping: shippingLine(profile)?.replace(/^Shipping: /, '') ?? null,
    payment: profile.payment.trim() || null,
    lots,
    buyers: [...byBuyer.values()].sort((a, b) => a.name.localeCompare(b.name)),
    questions: report ? openQuestions(report, lots) : [],
  };
}

/** The lots nobody claimed, kept on the sale when it closes so they can go up again. */
export function unclaimedLots(r: Rundown, sale: Sale): Lot[] {
  return r.lots
    .filter((l) => !l.winner && !l.tie)
    .map(
      (l) =>
        sale.lots.find((x) => x.number === l.number) ?? {
          number: l.number, plantId: null, name: l.name, noid: false, price: l.price, description: '', photoUri: null,
        },
    );
}

/**
 * What a buyer asked or said that still needs the seller: any buyer comment with a question
 * in it, anything the claim tracker couldn't place, and talk under a lot that ended up unsold
 * (like a buyer saying "throw it in" after a take back).
 */
function openQuestions(report: ClaimReport, lots: RundownLot[]): OpenQuestion[] {
  const lotOf = new Map<number, number>();
  const unsoldTalk = new Set<number>();
  for (const l of report.lots) {
    for (const c of [...l.queue, ...l.released]) if (!lotOf.has(c.commentIndex)) lotOf.set(c.commentIndex, l.lot);
    for (const o of l.others) {
      if (!lotOf.has(o.index)) lotOf.set(o.index, l.lot);
      const sold = lots.find((x) => x.number === l.lot);
      if (!o.fromSeller && sold && !sold.winner && !sold.tie) unsoldTalk.add(o.index);
    }
  }
  const unplaced = new Set(report.unplaced.map((c) => c.index));
  const names = [...new Set(report.comments.map((c) => c.author))].sort((a, b) => b.length - a.length);
  const asks = (c: ThreadComment) => !c.fromSeller && /\?/.test(c.body);
  return report.comments
    .filter((c) => asks(c) || unplaced.has(c.index) || unsoldTalk.has(c.index))
    .map((c) => ({
      author: c.author,
      text: spoken(c.body, names) || cleanMentions(c.body).trim(),
      lot: lotOf.get(c.index) ?? null,
      time: showTime(c.timeHint),
    }));
}

/* ---------- the Sales Record document ---------- */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function money(n: number | null): string {
  return n === null ? '' : formatPrice(n) || '$0';
}

/** One readable page: totals, winners by lot, buyer totals, open questions. Prints to PDF. */
export function salesRecordHtml(r: Rundown): string {
  const heading = r.formatId === 'commons' ? `${COMMONS_MARKET} Sales Record` : 'Sales Record';
  const title = `${heading}${r.sellerName ? `, ${r.sellerName}` : ''}`;
  const lotRows = r.lots
    .map((l) => {
      const who = l.winner
        ? esc(l.winner)
        : l.tie
          ? `<span class="warn">Tie: ${esc(l.tie.join(' or '))}. Your call.</span>`
          : '<span class="soft">Unclaimed</span>';
      const next = l.line.length ? esc(l.line.join(', ')) : '';
      return `<tr><td class="n">${l.number}</td><td>${esc(l.name)}</td><td class="m">${money(l.price)}</td><td>${who}</td><td class="soft">${next}</td></tr>`;
    })
    .join('');
  const buyerRows = r.buyers
    .map(
      (b) =>
        `<tr><td><b>${esc(b.name)}</b>${b.history ? '<br><span class="soft">Repeat buyer</span>' : ''}</td><td>${b.lots.map((l) => `Lot ${l.number}, ${esc(l.name)}${l.price !== null ? `, ${money(l.price)}` : ''}`).join('<br>')}</td><td class="m"><b>${money(b.total)}</b></td></tr>`,
    )
    .join('');
  const questions = r.questions.length
    ? `<ul>${r.questions
        .map((q) => `<li><b>${esc(q.author)}</b>${q.lot !== null ? ` on lot ${q.lot}` : ' in the thread'}${q.time ? `, ${esc(q.time)}` : ''}: ${esc(q.text)}</li>`)
        .join('')}</ul>`
    : '<p class="soft">None.</p>';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font-family:Helvetica,Arial,sans-serif;color:#1F2A1F;margin:32px;font-size:12px;line-height:1.4}
h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:22px 0 6px;color:#2C4F29}
table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:5px 6px;border-bottom:1px solid #DCD8CC;vertical-align:top}
th{font-size:11px;color:#5E6B5E;font-weight:600}.n{width:28px}.m{text-align:right;white-space:nowrap}
.soft{color:#5E6B5E}.warn{color:#9A5B00;font-weight:600}.totals td{border:none;padding:2px 12px 2px 0}
ul{padding-left:18px;margin:0}li{margin-bottom:4px}footer{margin-top:28px;font-size:10px;color:#5E6B5E}
</style></head><body>
<h1>${esc(title)}</h1><div class="soft">${SHOWCASE}, ${esc(formatLongDate(r.day))}</div>
<h2>Totals</h2><table class="totals">
<tr><td>Lots claimed</td><td><b>${r.lotsClaimed} of ${r.lotsOffered}</b></td></tr>
<tr><td>Claimed value</td><td><b>${money(r.claimedValue)}</b></td></tr>
${r.shipping ? `<tr><td>Shipping</td><td>${esc(r.shipping)}</td></tr>` : ''}
${r.payment ? `<tr><td>Payment</td><td>${esc(r.payment)}</td></tr>` : ''}
</table>
<h2>Winners by lot</h2><table><tr><th>Lot</th><th>Plant</th><th class="m">Price</th><th>Winner</th><th>Next in line</th></tr>${lotRows}</table>
<h2>Buyer totals</h2>${r.buyers.length ? `<table><tr><th>Buyer</th><th>Lots</th><th class="m">Total</th></tr>${buyerRows}</table>` : '<p class="soft">No winners yet.</p>'}
<h2>Open buyer questions</h2>${questions}
<footer>${esc(ORIGIN_LINE)}</footer>
</body></html>`;
}
