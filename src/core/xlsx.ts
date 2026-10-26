/**
 * Just enough of the .xlsx format to carry one sheet of text and numbers to Google Sheets or Excel
 * and read it back. A workbook is a zip of XML parts; fflate does the zipping.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export type CellValue = string | number | null;

export interface SheetLayout {
  /** Column widths, in characters. */
  widths?: number[];
  /** Zero based rows drawn in bold. */
  boldRows?: number[];
  /** Zero based columns whose text wraps. */
  wrapCols?: number[];
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Control characters other than tab and newline aren't allowed in XML.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

export function columnName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export function writeXlsx(rows: CellValue[][], sheetName: string, layout: SheetLayout = {}): Uint8Array {
  const bold = new Set(layout.boldRows ?? []);
  const wrap = new Set(layout.wrapCols ?? []);
  // Styles: 0 plain, 1 bold, 2 wrapped, 3 bold and wrapped.
  const style = (r: number, c: number) => (bold.has(r) ? 1 : 0) + (wrap.has(c) ? 2 : 0);
  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          if (v === null || v === '') return '';
          const ref = `${columnName(c)}${r + 1}`;
          const s = style(r, c);
          const sAttr = s ? ` s="${s}"` : '';
          if (typeof v === 'number') return `<c r="${ref}"${sAttr}><v>${v}</v></c>`;
          return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  const cols = layout.widths?.length
    ? `<cols>${layout.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';

  const files: Record<string, string> = {
    '[Content_Types].xml':
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
    '_rels/.rels':
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml':
      `${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>` +
      `<sheet name="${esc(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml':
      `${XML}<styleSheet xmlns="${NS}">` +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' +
      '</cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': `${XML}<worksheet xmlns="${NS}">${cols}<sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
}

function unescape(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[k]!;
  });
}

/** The text of every <t> run inside a piece of XML, joined: a plain or rich text string. */
function runsText(xml: string): string {
  let out = '';
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += unescape(m[1]);
  return out;
}

const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/** The workbook's first sheet, by its relationship, falling back to sheet1.xml. */
function firstSheetPath(files: Record<string, Uint8Array>): string | null {
  const wb = files['xl/workbook.xml'] && strFromU8(files['xl/workbook.xml']);
  const rels = files['xl/_rels/workbook.xml.rels'] && strFromU8(files['xl/_rels/workbook.xml.rels']);
  const sheetTag = wb ? /<sheet\s[^>]*>/.exec(wb)?.[0] : undefined;
  const id = sheetTag ? attr(sheetTag, 'r:id') : undefined;
  if (id && rels) {
    for (const m of rels.matchAll(/<Relationship\s[^>]*>/g)) {
      if (attr(m[0], 'Id') !== id) continue;
      const target = attr(m[0], 'Target') ?? '';
      const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
      if (files[path]) return path;
    }
  }
  if (files['xl/worksheets/sheet1.xml']) return 'xl/worksheets/sheet1.xml';
  return Object.keys(files).find((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k)) ?? null;
}

/** True when the bytes are a zip, which an .xlsx always is. */
export function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/** Every row of the first sheet as text, with blank cells as empty strings. Throws on a file that isn't a workbook. */
export function readXlsx(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes);
  const path = firstSheetPath(files);
  if (!path) throw new Error('No sheet in this workbook');
  const shared: string[] = [];
  const sst = files['xl/sharedStrings.xml'];
  if (sst) for (const m of strFromU8(sst).matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(runsText(m[1]));

  const rows: string[][] = [];
  const sheet = strFromU8(files[path]);
  for (const rm of sheet.matchAll(/<row(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rAttr = rm[1] ? attr(rm[1], 'r') : undefined;
    const r = rAttr ? Number(rAttr) - 1 : rows.length;
    const row: string[] = [];
    let next = 0;
    for (const cm of (rm[2] ?? '').matchAll(/<c(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = cm[1] ?? '';
      const ref = attr(tag, 'r');
      const c = ref ? columnIndex(ref) : next;
      next = c + 1;
      const body = cm[2] ?? '';
      const type = attr(tag, 't');
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let text = '';
      if (type === 's') text = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') text = runsText(body);
      else if (type === 'b') text = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined) text = unescape(v);
      while (row.length < c) row.push('');
      row[c] = text;
    }
    while (rows.length < r) rows.push([]);
    rows[r] = row;
  }
  return rows;
}
