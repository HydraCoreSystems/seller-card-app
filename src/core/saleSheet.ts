/**
 * The Sale Sheet: one document that carries a Grower Showcase to a computer and back. The seller
 * profile sits at the top, then one row per lot under fixed headings. The same shape goes out and
 * comes back in; the columns never change. Pictures don't travel in it, and it says so.
 */
import { strFromU8 } from 'fflate';
import { ORIGIN_LINE, SHOWCASE } from './brand';
import { COMMONS_MARKET, VERIFIED_GROWER } from './formats/commons';
import { shippingLine } from './formats/parts';
import { formatDay, parsePrice } from './text';
import { nameKey } from './records';
import type { RundownLot } from './rundown';
import type { FormatId, Plant, Profile, Sale } from './types';
import { isZip, readXlsx, type CellValue, type SheetLayout } from './xlsx';

export const SHEET_COLUMNS = ['Lot', 'Plant name', 'NOID', 'Price or opening price', 'Description', 'Claimed by', 'Payment'] as const;

export const NO_PICTURES = 'Pictures don’t travel in this sheet. After you import it, each lot waits for its photo on the phone.';
export const HOW_TO_FILL =
  'Type one lot per row under the headings, in the order you’ll post them. Put Yes under NOID when the name isn’t confirmed. The app numbers the lots as listed.';

export function sheetTitle(formatId: FormatId): string {
  return `${formatId === 'commons' ? COMMONS_MARKET : SHOWCASE} Sale Sheet`;
}

/** How a lot stood after the showcase ran: who has it and whether they've paid. */
export interface SheetLotState {
  claimedBy: string | null;
  payment: string | null;
}

export interface SaleSheet {
  rows: CellValue[][];
  layout: SheetLayout;
}

/** The sheet for a showcase, or the blank template when sale is null. */
export function saleSheet(profile: Profile, sale: Sale | null, state: Map<number, SheetLotState> = new Map()): SaleSheet {
  const formatId = sale?.formatId ?? profile.defaultFormat;
  const number = profile.sellerNumber.trim();
  const showcase = sale
    ? `${SHOWCASE}${sale.kind === 'auction' ? ' auction' : ''}${sale.opens ? `, ${formatDay(sale.opens.day)}` : ''}`
    : null;
  const about: [string, string | null][] = [
    ['Seller', profile.sellerName.trim()],
    [formatId === 'commons' ? `${VERIFIED_GROWER} No.` : 'Seller number', number || null],
    ['Shipping', shippingLine(profile)?.replace(/^Shipping: /, '') ?? null],
    ['Payment', profile.payment.trim() || null],
    ['Time zone', profile.timeZone.trim() || null],
    ['Showcase', showcase],
  ];
  const top: CellValue[][] = [
    [sheetTitle(formatId)],
    [ORIGIN_LINE],
    [NO_PICTURES],
    [HOW_TO_FILL],
    [],
    ...about.filter(([, v]) => v).map(([k, v]) => [k, v]),
    [],
  ];
  const lots: CellValue[][] = (sale?.lots ?? []).map((l) => {
    const s = state.get(l.number);
    return [l.number, l.name, l.noid ? 'Yes' : 'No', l.price, l.description, s?.claimedBy ?? null, s?.payment ?? null];
  });
  return {
    rows: [...top, [...SHEET_COLUMNS], ...lots],
    layout: { widths: [6, 34, 7, 14, 50, 22, 12], boldRows: [0, top.length], wrapCols: [4] },
  };
}

export interface SheetLot {
  /** The row in the sheet, counted from 1 as Sheets and Excel show it. */
  row: number;
  name: string;
  noid: boolean;
  price: number | null;
  description: string;
}

export interface SheetProblem {
  row: number;
  text: string;
}

export type SheetRead =
  | { ok: true; lots: SheetLot[]; problems: SheetProblem[]; claimsLeftOut: boolean }
  | { ok: false; error: string };

const YES = new Set(['yes', 'y', 'true', 'x', 'noid']);
const NO = new Set(['', 'no', 'n', 'false']);

/** Reads a filled sheet: every lot row in order, and every row that can't be read, by row number. */
export function readSaleSheet(rows: string[][]): SheetRead {
  const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();
  const headerAt = rows.findIndex((r) => r.some((c) => norm(c) === 'plant name'));
  if (headerAt < 0) {
    return { ok: false, error: 'This doesn’t look like a Sale Sheet. There’s no Plant name heading. Export a blank Sale Sheet to see the shape.' };
  }
  const header = rows[headerAt].map(norm);
  const col = (name: (typeof SHEET_COLUMNS)[number]) => header.indexOf(name.toLowerCase());
  const [nameCol, noidCol, priceCol, descCol, claimCol, payCol] = [
    col('Plant name'), col('NOID'), col('Price or opening price'), col('Description'), col('Claimed by'), col('Payment'),
  ];
  const cell = (r: string[], c: number) => (c >= 0 ? (r[c] ?? '').trim() : '');

  const lots: SheetLot[] = [];
  const problems: SheetProblem[] = [];
  let claimsLeftOut = false;
  rows.slice(headerAt + 1).forEach((r, i) => {
    const row = headerAt + 2 + i;
    if (!r.some((c) => c.trim())) return;
    let name = cell(r, nameCol);
    const noidText = cell(r, noidCol);
    const priceText = cell(r, priceCol);
    if (cell(r, claimCol) || cell(r, payCol)) claimsLeftOut = true;

    const flags: string[] = [];
    let noid = false;
    if (YES.has(noidText.toLowerCase())) noid = true;
    else if (!NO.has(noidText.toLowerCase())) flags.push(`NOID says “${noidText}”. Put Yes or No.`);
    // "Hoya NOID" typed into the name means the same as Yes under NOID.
    const typedNoid = /^(.*?)\s*\bNOID\b.*$/i.exec(name);
    if (typedNoid) {
      noid = true;
      name = typedNoid[1].trim();
    }
    if (!name && !noid) flags.push('There’s no plant name. Put Yes under NOID if the name isn’t confirmed.');
    let price: number | null = null;
    if (priceText) {
      const p = parsePrice(priceText);
      if (p === null) flags.push(`The price “${priceText}” isn’t a number. Type it like 25.`);
      else price = Math.round(p * 100) / 100;
    }
    if (flags.length) problems.push({ row, text: flags.join(' ') });
    else lots.push({ row, name, noid, price, description: cell(r, descCol) });
  });
  return { ok: true, lots, problems, claimsLeftOut };
}

/**
 * The plant already on the list for each imported lot, so a row attaches to it (and its photo)
 * instead of making a duplicate. Only plants still for sale count, and a NOID matches only a NOID.
 */
export function plantsOnList(plants: Plant[], lots: SheetLot[]): (Plant | null)[] {
  const key = (name: string, noid: boolean) => `${noid ? 'noid:' : ''}${nameKey(name)}`;
  const onList = new Map<string, Plant>();
  for (const p of plants) if (!p.sold && nameKey(p.name) && !onList.has(key(p.name, p.noid))) onList.set(key(p.name, p.noid), p);
  return lots.map((l) => (nameKey(l.name) ? onList.get(key(l.name, l.noid)) ?? null : null));
}

/** The rows of a picked file: an .xlsx from Sheets or Excel, or a CSV. Throws on a broken workbook. */
export function sheetRowsFromBytes(bytes: Uint8Array): string[][] {
  return isZip(bytes) ? readXlsx(bytes) : parseCsv(strFromU8(bytes));
}

/** Claim and payment state from the rundown, for a showcase that's already run. */
export function sheetState(lots: RundownLot[], closed: boolean): Map<number, SheetLotState> {
  const state = new Map<number, SheetLotState>();
  for (const l of lots) {
    const claimedBy = l.winner ?? (l.tie ? `Tie: ${l.tie.join(' or ')}` : null);
    const payment = closed && l.winner ? (l.payment === 'paid' ? 'Paid' : l.payment === 'never' ? 'Never paid' : 'Waiting') : null;
    if (claimedBy) state.set(l.number, { claimedBy, payment });
  }
  return state;
}

/** Reads CSV text, the other way a sheet can come back: quoted cells, doubled quotes, any line ending. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  // Excel in some countries saves with semicolons; go by whichever the heading line uses.
  const headingLine = src.split(/\r?\n/).find((l) => /plant name/i.test(l)) ?? src;
  const sep = (headingLine.match(/;/g)?.length ?? 0) > (headingLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cellText = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cellText += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cellText += ch;
    } else if (ch === '"' && cellText === '') quoted = true;
    else if (ch === sep) {
      row.push(cellText);
      cellText = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cellText);
      rows.push(row);
      row = [];
      cellText = '';
    } else cellText += ch;
  }
  if (cellText !== '' || row.length) {
    row.push(cellText);
    rows.push(row);
  }
  return rows;
}
