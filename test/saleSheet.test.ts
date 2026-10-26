/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { trackClaims } from '../src/core/claims';
import { buildRundown } from '../src/core/rundown';
import { NO_PICTURES, SHEET_COLUMNS, parseCsv, plantsOnList, readSaleSheet, saleSheet, sheetRowsFromBytes, sheetState } from '../src/core/saleSheet';
import { DASH_PATTERN } from '../src/core/text';
import type { Lot, Plant, Profile, Sale } from '../src/core/types';
import { readXlsx, writeXlsx } from '../src/core/xlsx';

const profile: Profile = {
  sellerName: 'Phil Achleman', sellerNumber: '12', shipping: '$8 flat', shippingDays: [], payment: 'Venmo @phil',
  timeZone: 'Eastern', claimRules: '', defaultFormat: 'generic', payWindowHours: 24,
};
const lot = (number: number, name: string, price: number | null, description = '', noid = false): Lot => ({
  number, plantId: null, name, noid, price, description, photoUri: null,
});
const sale: Sale = {
  id: 's', formatId: 'generic', kind: 'sale', opens: { day: '2026-10-30', time: '19:00' }, closes: null, closeCall: '',
  claimRules: '', crossListing: '', createdAt: '2026-10-25',
  lots: [
    lot(1, 'Hoya carnosa Krimson Queen', 25, 'Rooted, 6 leaves, "new growth"\nShips bare root'),
    lot(2, 'Hoya', 12.5, 'Big leaves & fuzzy', true),
    lot(3, 'Monstera Thai Constellation', null),
  ],
};
const text = (rows: (string | number | null)[][]) => rows.map((r) => r.map((c) => (c === null ? '' : String(c))));
const toXlsx = (s: ReturnType<typeof saleSheet>) => writeXlsx(s.rows, 'Grower Showcase Sale Sheet', s.layout);

describe('the Sale Sheet going out', () => {
  const sheet = saleSheet(profile, sale);
  const rows = text(sheet.rows);

  it('puts the profile on top, says pictures stay behind, then one row per lot', () => {
    expect(rows[0]).toEqual(['Grower Showcase Sale Sheet']);
    expect(rows[1]).toEqual(['Made with Seller Card App by Gathering Moss']);
    expect(rows[2]).toEqual([NO_PICTURES]);
    expect(rows).toContainEqual(['Seller', 'Phil Achleman']);
    expect(rows).toContainEqual(['Seller number', '12']);
    expect(rows).toContainEqual(['Shipping', '$8 flat']);
    expect(rows).toContainEqual(['Showcase', 'Grower Showcase, Friday, October 30']);
    const h = rows.findIndex((r) => r[1] === 'Plant name');
    expect(rows[h]).toEqual([...SHEET_COLUMNS]);
    expect(rows.slice(h + 1).map((r) => r.slice(0, 4))).toEqual([
      ['1', 'Hoya carnosa Krimson Queen', 'No', '25'],
      ['2', 'Hoya', 'Yes', '12.5'],
      ['3', 'Monstera Thai Constellation', 'No', ''],
    ]);
  });

  it('speaks Commons only inside the Commons format', () => {
    const commons = text(saleSheet(profile, { ...sale, formatId: 'commons' }).rows);
    expect(commons[0]).toEqual(['Commons Market Sale Sheet']);
    expect(commons).toContainEqual(['Commons Verified Grower No.', '12']);
    expect(rows.flat().join(' ')).not.toContain('Commons');
  });

  it('gives the blank template the same headings and no lots', () => {
    const blank = text(saleSheet(profile, null).rows);
    expect(blank[blank.length - 1]).toEqual([...SHEET_COLUMNS]);
    expect(blank.flat()).not.toContain('Showcase');
  });

  it('keeps dashes out of every word it writes', () => {
    for (const s of [sheet, saleSheet(profile, null), saleSheet(profile, { ...sale, formatId: 'commons' })]) {
      const words = s.rows.slice(0, s.layout.boldRows![1] + 1).flat().filter((c) => typeof c === 'string');
      for (const w of words) expect(w).not.toMatch(DASH_PATTERN);
    }
  });

  it('carries claim and payment state on a showcase that has run', () => {
    const purge: Sale = { ...sale, id: 'purge', lots: [] };
    const report = trackClaims(readFileSync(join(__dirname, 'fixtures/purge-2026-10-23.txt'), 'utf8'));
    const r = buildRundown({ sale: purge, profile, report, records: [] });
    const lots = r.lots.map((l) => lot(l.number, l.name, l.price));
    const state = sheetState(r.lots, true);
    const out = text(saleSheet(profile, { ...purge, lots }, state).rows);
    expect(out.find((row) => row[0] === '2')!.slice(5)).toEqual(['Ava Stone', 'Waiting']);
    expect(out.find((row) => row[0] === '11')![5]).toMatch(/^Tie: /);
    expect(out.find((row) => row[0] === '1')!.slice(5)).toEqual(['', '']);
  });
});

describe('the .xlsx file', () => {
  it('opens as a real workbook and reads back cell for cell', () => {
    const sheet = saleSheet(profile, sale);
    const bytes = toXlsx(sheet);
    const parts = unzipSync(bytes);
    expect(Object.keys(parts)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']));
    expect(strFromU8(parts['xl/worksheets/sheet1.xml'])).toContain('&quot;new growth&quot;');
    const back = readXlsx(bytes);
    const want = text(sheet.rows).map((r) => {
      const out = [...r];
      while (out.length && out[out.length - 1] === '') out.pop();
      return out;
    });
    expect(back).toEqual(want);
  });

  it('reads shared strings, rich text and skipped cells the way Sheets and Excel write them', () => {
    const xml = (s: string) => strToU8(`<?xml version="1.0"?>${s}`);
    const bytes = zipSync({
      'xl/workbook.xml': xml('<workbook xmlns:r="r"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId3"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': xml('<Relationships><Relationship Id="rId3" Target="worksheets/sheet7.xml"/></Relationships>'),
      'xl/sharedStrings.xml': xml('<sst><si><t>Plant name</t></si><si><r><t>Hoya </t></r><r><rPr><b/></rPr><t>kerrii</t></r></si><si><t>Lot</t></si></sst>'),
      'xl/worksheets/sheet7.xml': xml(
        '<worksheet><sheetData>' +
          '<row r="1"><c r="A1" t="s"><v>2</v></c><c r="B1" t="s"><v>0</v></c></row>' +
          '<row r="2"/>' +
          '<row r="4"><c r="B4" t="s"><v>1</v></c><c r="D4"><v>18</v></c><c r="E4" t="str"><f>A1</f><v>Tom &amp; Jo</v></c></row>' +
          '</sheetData></worksheet>',
      ),
    });
    expect(readXlsx(bytes)).toEqual([['Lot', 'Plant name'], [], [], ['', 'Hoya kerrii', '', '18', 'Tom & Jo']]);
  });
});

describe('the Sale Sheet coming back', () => {
  it('builds the same lots from its own export, in order', () => {
    const read = readSaleSheet(sheetRowsFromBytes(toXlsx(saleSheet(profile, sale))));
    expect(read).toEqual({
      ok: true,
      problems: [],
      claimsLeftOut: false,
      lots: [
        { row: 14, name: 'Hoya carnosa Krimson Queen', noid: false, price: 25, description: 'Rooted, 6 leaves, "new growth"\nShips bare root' },
        { row: 15, name: 'Hoya', noid: true, price: 12.5, description: 'Big leaves & fuzzy' },
        { row: 16, name: 'Monstera Thai Constellation', noid: false, price: null, description: '' },
      ],
    });
  });

  it('flags every row it can’t read, by row number, and keeps the rest in order', () => {
    const rows = text(saleSheet(profile, null).rows);
    const h = rows.length;
    rows.push(
      ['', 'Hoya kerrii', '', '$18.00', 'Heart leaf'],
      ['', '', '', '', ''],
      ['', '', 'No', '20', 'Just a description'],
      ['', 'Hoya pubicalyx', 'maybe', 'twenty'],
      ['', 'Hoya NOID', '', '10'],
      ['7', 'Dischidia', 'n', '9', '', 'Ava Stone', 'Paid'],
    );
    const read = readSaleSheet(rows);
    if (!read.ok) throw new Error(read.error);
    expect(read.lots.map((l) => [l.row, l.name, l.noid, l.price])).toEqual([
      [h + 1, 'Hoya kerrii', false, 18],
      [h + 5, 'Hoya', true, 10],
      [h + 6, 'Dischidia', false, 9],
    ]);
    expect(read.problems).toEqual([
      { row: h + 3, text: 'There’s no plant name. Put Yes under NOID if the name isn’t confirmed.' },
      { row: h + 4, text: 'NOID says “maybe”. Put Yes or No. The price “twenty” isn’t a number. Type it like 25.' },
    ]);
    expect(read.claimsLeftOut).toBe(true);
    for (const p of read.problems) expect(p.text).not.toMatch(DASH_PATTERN);
  });

  it('reads the .xlsx Google Sheets hands back after the sheet was opened there', () => {
    // A real export from Drive: shared strings, 1000 padded rows, numbers written as 25.0.
    const read = readSaleSheet(sheetRowsFromBytes(new Uint8Array(readFileSync(join(__dirname, 'fixtures/google-sheets-export.xlsx')))));
    expect(read).toEqual({
      ok: true,
      problems: [],
      claimsLeftOut: false,
      lots: [
        { row: 14, name: 'Hoya carnosa Krimson Queen', noid: false, price: 25, description: 'Rooted, 6 leaves, "new growth"\nShips bare root' },
        { row: 15, name: 'Hoya', noid: true, price: 12.5, description: 'Big leaves & fuzzy' },
      ],
    });
  });

  it('attaches a row to the plant already on the list instead of making a duplicate', () => {
    const plant = (id: string, name: string, noid = false, sold = false): Plant => ({
      id, name, noid, sold, price: 20, kind: 'sale', photoUri: `${id}.jpg`, notes: '', createdAt: '2026-10-01',
    });
    const plants = [plant('kq', 'Hoya carnosa Krimson Queen'), plant('gone', 'Hoya kerrii', false, true), plant('n', 'Hoya', true)];
    const row = (name: string, noid = false) => ({ row: 1, name, noid, price: 25, description: '' });
    expect(
      plantsOnList(plants, [
        row('hoya carnosa  Krimson-Queen'),
        row('Hoya kerrii'),
        row('Hoya', true),
        row('Hoya'),
        row('Dischidia'),
      ]).map((p) => p?.id ?? null),
    ).toEqual(['kq', null, 'n', null, null]);
  });

  it('reads a CSV saved from a spreadsheet, quotes, commas and all', () => {
    const csv = '﻿Grower Showcase Sale Sheet\r\n\r\nLot,Plant name,NOID,Price or opening price,Description\r\n1,"Hoya ""Splash""",No,"$1,200","Rooted, big"\r\n2,Hoya,Yes,15,"two\nlines"\r\n';
    const read = readSaleSheet(sheetRowsFromBytes(strToU8(csv)));
    if (!read.ok) throw new Error(read.error);
    expect(read.lots.map((l) => [l.name, l.noid, l.price, l.description])).toEqual([
      ['Hoya "Splash"', false, 1200, 'Rooted, big'],
      ['Hoya', true, 15, 'two\nlines'],
    ]);
  });

  it('reads semicolon CSV from Excel set to European regions', () => {
    expect(parseCsv('Lot;Plant name;Price or opening price\n1;Hoya;12,50\n')[1]).toEqual(['1', 'Hoya', '12,50']);
  });

  it('says so plainly when a file isn’t a Sale Sheet', () => {
    const read = readSaleSheet(parseCsv('Name,Phone\nJo,555\n'));
    expect(read.ok).toBe(false);
  });
});
