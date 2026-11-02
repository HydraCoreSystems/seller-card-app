/**
 * One buyer's invoice, built from what the seller already told Skrybix: the room's name and details,
 * the buyer's Facebook name, the plants they won with prices, shipping, the total and how to pay.
 * It carries no Skrybix branding beyond the small origin line at the foot.
 */
import { originLine } from './brand';
import type { CheckoutRow } from './checkout';
import { locationLine } from './formats/parts';
import { formatLongDate, formatPrice } from './text';
import type { Profile } from './types';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const usd = (n: number | null) => formatPrice(n) || '$0';

/** Pieces of the invoice as plain text, so the content is tested without the page around it. */
export interface InvoiceContent {
  heading: string;
  sellerLines: string[];
  buyer: string;
  day: string;
  lots: { text: string; price: string }[];
  totals: { label: string; value: string; strong?: boolean }[];
  paid: boolean;
  payLines: string[];
}

export function invoiceContent(row: CheckoutRow, room: Profile, day: string): InvoiceContent {
  const business = room.growerBusiness?.trim().replace(/^also\s+(dba\s+)?/i, '');
  const heading = room.venueName?.trim() || business || room.sellerName.trim() || 'Invoice';
  const sellerLines = [
    room.sellerName.trim() && room.sellerName.trim() !== heading ? room.sellerName.trim() : '',
    (locationLine(room) ?? '').replace(/^Location:\s*/, ''),
  ].filter(Boolean);

  const totals: InvoiceContent['totals'] = [{ label: 'Plants', value: usd(row.plantsTotal) }];
  if (row.pickup) {
    totals.push({ label: 'Local pickup', value: 'No shipping' }, { label: 'Total', value: usd(row.totalOwed), strong: true });
  } else if (row.totalKnown) {
    totals.push({ label: 'Shipping', value: usd(row.shippingCharge) }, { label: 'Total', value: usd(row.totalOwed), strong: true });
  } else {
    totals.push({ label: 'Shipping', value: row.shippingNote ?? 'To be confirmed' });
  }
  return {
    heading,
    sellerLines,
    buyer: row.buyer,
    day,
    lots: row.lots.map((l) => ({ text: `Lot ${l.number}, ${l.name}`, price: l.price === null ? '' : usd(l.price) })),
    totals,
    paid: row.paid,
    payLines: row.paid ? [] : room.payment.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
  };
}

export function invoiceHtml(row: CheckoutRow, room: Profile, day: string): string {
  const c = invoiceContent(row, room, day);
  const lots = c.lots.map((l) => `<tr><td>${esc(l.text)}</td><td class="r">${esc(l.price)}</td></tr>`).join('');
  const totals = c.totals
    .map((t) => `<tr class="${t.strong ? 'strong' : ''}"><td>${esc(t.label)}</td><td class="r">${esc(t.value)}</td></tr>`)
    .join('');
  const pay = c.paid
    ? '<p class="paid">Paid. Thank you!</p>'
    : c.payLines.length
      ? `<h2>How to pay</h2>${c.payLines.map((l) => `<p>${esc(l)}</p>`).join('')}`
      : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice for ${esc(c.buyer)}</title><style>
body{font-family:Helvetica,Arial,sans-serif;color:#1F2A1F;margin:36px;font-size:14px;line-height:1.45}
h1{font-size:24px;margin:0}h2{font-size:15px;margin:22px 0 6px}.soft{color:#5E6B5E}p{margin:2px 0}
.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1F2A1F;padding-bottom:10px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-top:6px}td{padding:6px 0;border-bottom:1px solid #DCD8CC}.r{text-align:right}
.strong td{font-weight:700;font-size:16px;border-bottom:none;padding-top:10px}.paid{font-weight:700;margin-top:18px}
.foot{margin-top:40px;font-size:11px;color:#5E6B5E}
</style></head><body>
<div class="top"><div><h1>${esc(c.heading)}</h1>${c.sellerLines.map((l) => `<p class="soft">${esc(l)}</p>`).join('')}</div><div class="r"><b>Invoice</b><p class="soft">${esc(formatLongDate(c.day))}</p></div></div>
<p class="soft">For</p><p><b>${esc(c.buyer)}</b></p>
<table>${lots}</table>
<table>${totals}</table>
${pay}
<p class="foot">${esc(originLine())}</p>
</body></html>`;
}

/** A file name that is safe to share: the buyer's name with anything odd taken out. */
export function invoiceFileName(buyer: string, day: string): string {
  const who = buyer.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'buyer';
  return `Invoice_${who}_${day}.pdf`;
}
