import { describe, expect, it } from 'vitest';
import { announcementFor } from '../src/core/announce';
import {
  addHours, buildCheckoutRows, buildLabelFile, closeoutComment, contactDeadlineText, contactLine, deadlineState, formFields, formReminder, labelProblem,
  matchResponses, mergeChances, noContactChances, noContactList, packingListHtml, packingRows, paidNoForm, paymentChoices, prefilledLink, readResponses,
  saleName, saleTimeMs, shippedMessage, winnerMessage, FORM_TOKEN, LABEL_HEADERS,
} from '../src/core/checkout';
import { buildRundown, type RundownBuyer } from '../src/core/rundown';
import { sampleData, sampleThread, SAMPLE_SALE_ID } from '../src/core/demo';
import { readClaims } from '../src/lib/claimReport';
import { PRO_POINTS, PRO_PRIVACY, PRO_TEST_NOTE, PRO_TITLE } from '../src/core/pro';
import { DASH_PATTERN } from '../src/core/text';
import type { CheckoutResponse, Profile, Sale } from '../src/core/types';
import { emptyVenue, withVenues } from '../src/core/venues';

// These cover what the Phil test version adds, so they run in that build.
process.env.EXPO_PUBLIC_APP_VARIANT = 'phil';

const room = { ...emptyVenue('v1', 'Hoya Swap Market'), shipping: 'USPS Priority, $10 flat', payment: 'PayPal Goods and Services, Venmo', contactHours: 24, weightOz: 12 };
const base: Profile = { sellerName: 'Rowan Ellery', sellerNumber: '', shipping: '', shippingDays: [], payment: '', timeZone: 'Eastern', claimRules: '', defaultFormat: 'generic' };
const profile = withVenues(base, [room], 'v1');
const room1 = () => ({ ...profile, venueId: 'v1', venueName: 'Hoya Swap Market', contactHours: 24, weightOz: 12 as number | null });

const sale = (extra: Partial<Sale> = {}): Sale => ({
  id: 's1', formatId: 'generic', venueId: 'v1', kind: 'sale', opens: { day: '2026-11-01', time: '19:00' }, closes: null, endsAt: { day: '2026-11-01', time: '21:00' },
  closeCall: '', claimRules: '', crossListing: '', lots: [], createdAt: '2026-11-01', ...extra,
});

const response = (row: number, name: string, extra: Partial<CheckoutResponse> = {}): CheckoutResponse => ({
  row, timestamp: '11/1/2026 21:30:00', saleName: 'Hoya Swap Market November 1', facebookName: name, email: 'a@example.com', shipToName: name, street: '12 Elm St', city: 'Fort Wayne',
  state: 'IN', zip: '46802', pickup: false, paymentMethod: 'Venmo', note: '', ...extra,
});

const buyer = (name: string, total: number, payment: RundownBuyer['payment'] = null, lots = [{ number: 1, name: 'Hoya carnosa', price: total }]): RundownBuyer => ({ name, lots, total, history: null, payment });

describe('the buyer contact deadline line', () => {
  it('names a real clock time: sale end plus the deadline hours, as a day and a time', () => {
    expect(contactDeadlineText(sale(), room1())).toBe('Monday, November 2 at 9:00 PM Eastern');
    expect(contactLine(sale(), room1())).toBe(
      'Message me within 24 hours of the sale ending, by Monday, November 2 at 9:00 PM Eastern, to arrange payment and shipping or pickup. If I don\'t hear from you by then, the plant goes to the next in line.',
    );
  });

  it('follows the hours the seller sets, for the sale or the room', () => {
    expect(contactDeadlineText(sale({ contactHours: 48 }), room1())).toBe('Tuesday, November 3 at 9:00 PM Eastern');
    expect(contactLine(sale({ contactHours: 12 }), room1())).toContain('within 12 hours');
    expect(contactLine(sale({ contactHours: 1 }), room1())).toContain('within 1 hour of');
    expect(contactDeadlineText(sale(), { ...room1(), contactHours: 36 })).toBe('Tuesday, November 3 at 9:00 AM Eastern');
  });

  it('uses an auction\'s close time as the sale end', () => {
    const auction = sale({ kind: 'auction', endsAt: null, closes: { day: '2026-11-02', time: '20:00' } });
    expect(contactDeadlineText(auction, room1())).toBe('Tuesday, November 3 at 8:00 PM Eastern');
  });

  it('says so in words when the sale has no end time, never inventing a clock time', () => {
    const open = sale({ endsAt: null });
    expect(contactDeadlineText(open, room1())).toBeNull();
    expect(contactLine(open, room1())).toBe('Message me within 24 hours of the sale ending to arrange payment and shipping or pickup. If I don\'t hear from you, the plant goes to the next in line.');
  });

  it('rolls over the end of a month and the end of a year', () => {
    expect(addHours({ day: '2026-12-31', time: '23:00' }, 24)).toEqual({ day: '2027-01-01', time: '23:00' });
    expect(addHours({ day: '2026-11-30', time: '20:30' }, 5)).toEqual({ day: '2026-12-01', time: '01:30' });
  });

  it('prints in the announcement for a Pro seller, and not for a free one', () => {
    const withLine = announcementFor(profile, sale(), true);
    expect(withLine).toContain('Message me within 24 hours of the sale ending, by Monday, November 2 at 9:00 PM Eastern');
    expect(announcementFor(profile, sale(), false)).not.toContain('Message me within');
    expect(DASH_PATTERN.test(withLine)).toBe(false);
  });

  it('keeps the form link out of the announcement', () => {
    const linked = withVenues(base, [{ ...room, formLink: 'https://docs.google.com/forms/d/e/ABC/viewform?usp=pp_url&entry.1=SPRIGSALE' }], 'v1');
    const text = announcementFor(linked, sale(), true);
    expect(text).not.toMatch(/docs\.google\.com|forms|SPRIGSALE/);
  });
});

describe('deadline states', () => {
  const end = saleTimeMs({ day: '2026-11-01', time: '21:00' });
  const deadline = end + 24 * 3_600_000;

  it('has no deadline until the sale has an end or is closed', () => {
    expect(deadlineState(sale({ endsAt: null }), room1(), end)).toEqual({ state: 'none' });
  });

  it('is open before the deadline, counting hours left, and passed from the moment it arrives', () => {
    expect(deadlineState(sale(), room1(), end + 3_600_000)).toEqual({ state: 'open', ms: deadline, hoursLeft: 23 });
    expect(deadlineState(sale(), room1(), deadline - 1).state).toBe('open');
    expect(deadlineState(sale(), room1(), deadline)).toEqual({ state: 'passed', ms: deadline });
  });

  it('falls back to the moment the seller closed the sale when no end was given', () => {
    const closed = sale({ endsAt: null, closedMs: end });
    expect(deadlineState(closed, room1(), end + 1000)).toMatchObject({ state: 'open', ms: deadline });
  });

  it('puts every winner with no form on the no contact list once it passes, and no one before', () => {
    const buyers = [buyer('Jada Winslow', 25), buyer('Marcus Bell', 18), buyer('Theo Marsh', 12)];
    const match = matchResponses([response(2, 'Jada Winslow')], buyers.map((b) => b.name), 'Hoya Swap Market November 1');
    const rowsAt = (now: number) => {
      const d = deadlineState(sale(), room1(), now);
      return { d, rows: buildCheckoutRows({ buyers, match, fulfillment: undefined, profile: room1(), deadline: d }) };
    };
    const before = rowsAt(deadline - 60_000);
    expect(before.rows.map((r) => r.contactState)).toEqual(['in', 'waiting', 'waiting']);
    expect(noContactList(before.rows, before.d)).toEqual([]);
    const after = rowsAt(deadline + 60_000);
    expect(after.rows.map((r) => r.contactState)).toEqual(['in', 'late', 'late']);
    expect(noContactList(after.rows, after.d).map((r) => r.buyer)).toEqual(['Marcus Bell', 'Theo Marsh']);
  });

  it('leaves a buyer who paid or never paid off the no contact list', () => {
    const buyers = [buyer('Jada Winslow', 25, 'paid'), buyer('Marcus Bell', 18, 'never'), buyer('Theo Marsh', 12)];
    const d = { state: 'passed', ms: 1 } as const;
    const rows = buildCheckoutRows({ buyers, match: matchResponses([], buyers.map((b) => b.name), 'x'), fulfillment: undefined, profile: room1(), deadline: d });
    expect(noContactList(rows, d).map((r) => r.buyer)).toEqual(['Theo Marsh']);
    expect(paidNoForm(rows).map((r) => r.buyer)).toEqual(['Jada Winslow']);
  });

  it('builds Second Chance cards from the no contact list, then lets them replace an overdue card for the same lot', () => {
    const closedMs = end;
    const s = sale({ closedMs, claimOrder: { 1: ['Marcus Bell', 'Theo Marsh'], 2: ['Theo Marsh'] } });
    const buyers = [buyer('Marcus Bell', 18, null, [{ number: 1, name: 'Hoya kerrii', price: 18 }])];
    const d = { state: 'passed', ms: deadline } as const;
    const rows = buildCheckoutRows({ buyers, match: matchResponses([], ['Marcus Bell'], 'x'), fulfillment: undefined, profile: room1(), deadline: d });
    const cards = noContactChances(s, rows, [{ id: 'r', saleId: 's1', lotNumber: 1, plantName: 'Hoya kerrii', buyer: 'Marcus Bell', price: 18, date: '2026-11-01' }], d);
    expect(cards).toEqual([{ lot: 1, name: 'Hoya kerrii', price: 18, buyer: 'Marcus Bell', runnerUp: 'Theo Marsh', kind: 'nocontact', dueMs: deadline }]);
    const overdue = { lot: 1, name: 'Hoya kerrii', price: 18, buyer: 'Marcus Bell', runnerUp: 'Theo Marsh', kind: 'overdue' as const, dueMs: deadline };
    expect(mergeChances([overdue], cards).map((c) => c.kind)).toEqual(['nocontact']);
    // Nothing before the deadline, and nothing for a lot already offered.
    expect(noContactChances(s, rows, [], { state: 'open', ms: deadline, hoursLeft: 3 })).toEqual([]);
    expect(noContactChances({ ...s, offers: [{ lot: 1, from: 'Marcus Bell', to: 'Theo Marsh', sentMs: 1 }] }, rows, [], d)).toEqual([]);
  });
});

describe('reading the checkout sheet', () => {
  const header = ['Timestamp', 'Sale name', 'Buyer Facebook name', 'Email', 'Shipped or local pickup', 'Ship to name', 'Street address', 'City', 'State', 'ZIP code', 'Payment method they will use', 'Note'];

  it('finds each column by its name, in whatever order the form wrote them', () => {
    const r = readResponses([header, ['11/1/2026 21:30', 'Hoya Swap Market November 1', 'Jada Winslow', 'j@example.com', 'Shipped', 'Jada W', '12 Elm St', 'Fort Wayne', 'IN', '46802', 'Venmo', 'Thanks!']]);
    expect(r).toMatchObject({ ok: true, saleColumn: true });
    if (!r.ok) throw new Error();
    expect(r.responses[0]).toEqual({
      row: 2, timestamp: '11/1/2026 21:30', saleName: 'Hoya Swap Market November 1', facebookName: 'Jada Winslow', email: 'j@example.com', shipToName: 'Jada W', street: '12 Elm St',
      city: 'Fort Wayne', state: 'IN', zip: '46802', pickup: false, paymentMethod: 'Venmo', note: 'Thanks!',
    });
    const shuffled = readResponses([['Email address', 'ZIP', 'What is your Facebook name?'], ['x@example.com', '46802', 'Marcus Bell']]);
    if (!shuffled.ok) throw new Error();
    expect(shuffled.responses[0]).toMatchObject({ email: 'x@example.com', zip: '46802', facebookName: 'Marcus Bell' });
  });

  it('reads local pickup, keeps row numbers, and skips empty rows', () => {
    const r = readResponses([header, ['', '', 'A', '', 'Local pickup'], ['', '', '', '', ''], ['', '', 'B', '', 'Shipped']]);
    if (!r.ok) throw new Error();
    expect(r.responses.map((x) => [x.row, x.facebookName, x.pickup])).toEqual([[2, 'A', true], [4, 'B', false]]);
  });

  it('says so when there is no Facebook name column or nothing at all', () => {
    expect(readResponses([['Email', 'City'], ['a', 'b']])).toMatchObject({ ok: false });
    expect(readResponses([])).toMatchObject({ ok: false });
  });
});

describe('response matching', () => {
  const winners = ['Jada Winslow', 'Marcus Bell', 'Theo Marsh'];
  const thisSale = 'Hoya Swap Market November 1';

  it('matches by Facebook name with case, spacing and punctuation set aside', () => {
    const m = matchResponses([response(2, 'jada  winslow'), response(3, 'MARCUS BELL.')], winners, thisSale);
    expect([...m.matched.keys()].sort()).toEqual(['jadawinslow', 'marcusbell']);
    expect(m.unmatched).toEqual([]);
  });

  it('flags a name that matches no winner and never merges or guesses', () => {
    const near = response(2, 'Jada W.');
    const stranger = response(3, 'Priya Lund');
    const m = matchResponses([near, stranger], winners, thisSale);
    expect(m.matched.size).toBe(0);
    expect(m.unmatched).toEqual([near, stranger]);
  });

  it('never matches a name with nothing a key can be made from', () => {
    const m = matchResponses([response(2, '李雷')], ['李雷'], thisSale);
    expect(m.matched.size).toBe(0);
    expect(m.unmatched).toHaveLength(1);
  });

  it('keeps the latest response when a buyer sends the form twice, and reports the earlier one', () => {
    const first = response(2, 'Jada Winslow', { street: '1 Old Rd' });
    const second = response(5, 'Jada Winslow', { street: '9 New Rd' });
    const m = matchResponses([first, second], winners, thisSale);
    expect(m.matched.get('jadawinslow')).toBe(second);
    expect(m.superseded).toEqual([first]);
  });

  it('sets aside a response tagged for another sale, and takes one with no sale name', () => {
    const other = response(2, 'Jada Winslow', { saleName: 'Hoya Swap Market October 25' });
    const blank = response(3, 'Marcus Bell', { saleName: '' });
    const m = matchResponses([other, blank], winners, thisSale);
    expect(m.otherSale).toEqual([other]);
    expect([...m.matched.keys()]).toEqual(['marcusbell']);
  });

  it('pairs a response by hand only when the seller says so, and only with a real winner', () => {
    const near = response(2, 'Jada W.');
    expect(matchResponses([near], winners, thisSale, { 2: 'jadawinslow' }).matched.get('jadawinslow')).toBe(near);
    expect(matchResponses([near], winners, thisSale, { 2: 'nobodyatall' }).unmatched).toEqual([near]);
  });

  it('leaves a winner with no response in a state the rundown can see', () => {
    const buyers = winners.map((n) => buyer(n, 10));
    const m = matchResponses([response(2, 'Jada Winslow')], winners, thisSale);
    const rows = buildCheckoutRows({ buyers, match: m, fulfillment: undefined, profile: room1(), deadline: { state: 'open', ms: 1, hoursLeft: 5 } });
    expect(rows.map((r) => [r.buyer, r.contacted, r.stage])).toEqual([['Jada Winslow', true, 'contacted'], ['Marcus Bell', false, 'won'], ['Theo Marsh', false, 'won']]);
  });

  it('matches a real rundown\'s winners', () => {
    const data = sampleData(new Date('2026-11-01T12:00:00'));
    const s = data.sales.find((x) => x.id === SAMPLE_SALE_ID)!;
    const rundown = buildRundown({ sale: s, profile: data.profile, report: readClaims(sampleThread(), s, data.profile), records: data.records });
    const m = matchResponses([response(2, 'Jada Winslow', { saleName: '' }), response(3, 'Somebody Else', { saleName: '' })], rundown.buyers.map((b) => b.name), 'x');
    expect([...m.matched.keys()]).toEqual(['jadawinslow']);
    expect(m.unmatched.map((r) => r.facebookName)).toEqual(['Somebody Else']);
  });
});

describe('the four states and what is owed', () => {
  const winners = ['Jada Winslow', 'Marcus Bell', 'Theo Marsh', 'Priya Lund'];
  const build = (buyers: RundownBuyer[], responses: CheckoutResponse[], fulfillment?: Parameters<typeof buildCheckoutRows>[0]['fulfillment'], p = room1()) =>
    buildCheckoutRows({ buyers, match: matchResponses(responses, winners, 'Hoya Swap Market November 1'), fulfillment, profile: p, deadline: { state: 'open', ms: 1, hoursLeft: 4 } });

  it('moves a winner from won, to contacted, to paid, to shipped', () => {
    const rows = build(
      [buyer('Jada Winslow', 25), buyer('Marcus Bell', 18, 'paid'), buyer('Theo Marsh', 12, 'paid'), buyer('Priya Lund', 15)],
      [response(2, 'Jada Winslow'), response(3, 'Marcus Bell'), response(4, 'Theo Marsh')],
      { theomarsh: { shipped: true } },
    );
    expect(rows.map((r) => r.stage)).toEqual(['contacted', 'paid', 'shipped', 'won']);
  });

  it('adds the room\'s flat shipping line to what each buyer owes, and none for local pickup', () => {
    const rows = build([buyer('Jada Winslow', 25), buyer('Marcus Bell', 18)], [response(2, 'Marcus Bell', { pickup: true })]);
    expect(rows[0]).toMatchObject({ plantsTotal: 25, shippingCharge: 10, totalOwed: 35, totalKnown: true });
    expect(rows[1]).toMatchObject({ plantsTotal: 18, shippingCharge: 0, totalOwed: 18, pickup: true });
  });

  it('says so when shipping is tiered, until the seller types what to charge', () => {
    const tiered = { ...room1(), shipping: 'USPS Priority: $10 for one box, $15 for two' };
    const [row] = build([buyer('Jada Winslow', 25)], [], undefined, tiered);
    expect(row).toMatchObject({ shippingCharge: null, totalKnown: false, totalOwed: 25, shippingNote: tiered.shipping });
    const [typed] = build([buyer('Jada Winslow', 25)], [], { jadawinslow: { shippingCharge: 15 } }, tiered);
    expect(typed).toMatchObject({ shippingCharge: 15, totalOwed: 40, totalKnown: true });
  });

  it('sets what the form said beside how it was paid, and flags a mismatch only when both are there', () => {
    const rows = build(
      [buyer('Jada Winslow', 25, 'paid'), buyer('Marcus Bell', 18, 'paid'), buyer('Theo Marsh', 12, 'paid')],
      [response(2, 'Jada Winslow', { paymentMethod: 'Venmo' }), response(3, 'Marcus Bell', { paymentMethod: 'Venmo' }), response(4, 'Theo Marsh', { paymentMethod: 'PayPal' })],
      { jadawinslow: { paidVia: 'venmo' }, marcusbell: { paidVia: 'PayPal Goods and Services' } },
    );
    expect(rows.map((r) => [r.intendedMethod, r.paidVia, r.methodMismatch])).toEqual([
      ['Venmo', 'venmo', false],
      ['Venmo', 'PayPal Goods and Services', true],
      ['PayPal', '', false],
    ]);
  });
});

describe('the paid gate on the label export', () => {
  const winners = ['Jada Winslow', 'Marcus Bell', 'Theo Marsh', 'Priya Lund', 'Sam Okafor'];
  const rows = buildCheckoutRows({
    buyers: [buyer('Jada Winslow', 25, 'paid'), buyer('Marcus Bell', 18), buyer('Theo Marsh', 12, 'never'), buyer('Priya Lund', 15, 'paid'), buyer('Sam Okafor', 20, 'paid')],
    match: matchResponses(
      [
        response(2, 'Jada Winslow', { street: '12 Elm St, Apt "B"' }),
        response(3, 'Marcus Bell'),
        response(4, 'Theo Marsh'),
        response(5, 'Priya Lund', { pickup: true }),
        response(6, 'Sam Okafor', { zip: '' }),
      ],
      winners,
      'Hoya Swap Market November 1',
    ),
    fulfillment: { jadawinslow: { weightOz: 20 } },
    profile: room1(),
    deadline: { state: 'passed', ms: 1 },
  });

  it('lets an unpaid row nowhere near the file, even when the caller passes it in', () => {
    const file = buildLabelFile(rows);
    expect(file.included.map((r) => r.buyer)).toEqual(['Jada Winslow']);
    expect(file.csv).not.toMatch(/Marcus|Theo/);
    expect(file.skipped).toEqual(expect.arrayContaining([
      { buyer: 'Marcus Bell', reason: 'Not marked paid' },
      { buyer: 'Theo Marsh', reason: 'Not marked paid' },
    ]));
    expect(labelProblem(rows[1])).toBe('Not marked paid');
  });

  it('refuses a paid row that is local pickup or has an incomplete address, and says why', () => {
    const file = buildLabelFile(rows);
    expect(file.skipped).toEqual(expect.arrayContaining([
      { buyer: 'Priya Lund', reason: 'Local pickup, no label needed' },
      { buyer: 'Sam Okafor', reason: 'Address is missing the ZIP' },
    ]));
  });

  it('writes the columns a batch upload needs, quoted where a buyer typed commas or quotes, with the box weight', () => {
    const file = buildLabelFile(rows);
    expect(file.csv).toBe(`${LABEL_HEADERS.join(',')}\r\nJada Winslow,"12 Elm St, Apt ""B""",Fort Wayne,IN,46802,20\r\n`);
  });

  it('takes the room\'s default weight when the seller gave none for the box, and counts rows with no weight', () => {
    const noOverride = buildCheckoutRows({
      buyers: [buyer('Jada Winslow', 25, 'paid')], match: matchResponses([response(2, 'Jada Winslow')], winners, 'Hoya Swap Market November 1'),
      fulfillment: undefined, profile: room1(), deadline: { state: 'passed', ms: 1 },
    });
    expect(buildLabelFile(noOverride).csv).toContain(',46802,12\r\n');
    const noWeight = buildLabelFile(buildCheckoutRows({
      buyers: [buyer('Jada Winslow', 25, 'paid')], match: matchResponses([response(2, 'Jada Winslow')], winners, 'Hoya Swap Market November 1'),
      fulfillment: undefined, profile: { ...room1(), weightOz: null }, deadline: { state: 'passed', ms: 1 },
    }));
    expect(noWeight.noWeight).toBe(1);
    expect(noWeight.csv).toContain(',46802,\r\n');
  });

  it('sets off buyer text a spreadsheet would run as a formula', () => {
    const evil = buildCheckoutRows({
      buyers: [buyer('Jada Winslow', 25, 'paid')], match: matchResponses([response(2, 'Jada Winslow', { street: '=HYPERLINK("http://x")' })], winners, 'Hoya Swap Market November 1'),
      fulfillment: undefined, profile: room1(), deadline: { state: 'passed', ms: 1 },
    });
    expect(buildLabelFile(evil).csv).toContain(' =HYPERLINK');
  });

  it('builds the packing view from matched, paid rows only, pickup included, exactly as typed', () => {
    const packing = packingRows(rows);
    expect(packing.map((r) => r.buyer)).toEqual(['Jada Winslow', 'Priya Lund', 'Sam Okafor']);
    const html = packingListHtml(packing, 'Packing list', { shipping: 'USPS Priority, $10 flat' });
    expect(html).toContain('12 Elm St, Apt &quot;B&quot;');
    expect(html).toContain('Local pickup');
    expect(html).toContain('USPS Priority, $10 flat');
    expect(html).toContain('Box 1');
    expect(html).not.toMatch(/Marcus|Theo/);
  });

  it('drafts the shipped message with the tracking number in it', () => {
    const msg = shippedMessage({ buyer: 'Jada Winslow', lots: [{ number: 1, name: 'Hoya carnosa', price: 25 }], tracking: '9400 1000 0000 0000 0000 00' });
    expect(msg).toContain('Hi Jada! Your plants shipped.');
    expect(msg).toContain('Tracking number: 9400 1000 0000 0000 0000 00');
    expect(DASH_PATTERN.test(msg.replace(/9400 1000 0000 0000 0000 00/, ''))).toBe(false);
  });
});

describe('the checkout form', () => {
  const name = saleName(sale(), { venueName: 'Hoya Swap Market' });

  it('names the sale from the room and the day, or uses what the seller typed', () => {
    expect(name).toBe('Hoya Swap Market November 1');
    expect(saleName(sale({ name: ' Fall Purge ' }), { venueName: 'x' })).toBe('Fall Purge');
  });

  it('fills the sale name into the seller\'s pre-filled link', () => {
    const link = `https://docs.google.com/forms/d/e/1FAIpQLSabc/viewform?usp=pp_url&entry.111=${FORM_TOKEN}&entry.222=other`;
    const r = prefilledLink(link, name);
    expect(r).toMatchObject({ tagged: true, problem: null });
    expect(r.url).toBe('https://docs.google.com/forms/d/e/1FAIpQLSabc/viewform?usp=pp_url&entry.111=Hoya%20Swap%20Market%20November%201&entry.222=other');
  });

  it('fills a link with just one pre-filled box, and says so when the link has none', () => {
    expect(prefilledLink('https://docs.google.com/forms/d/e/X/viewform?entry.9=anything', 'Fall Purge').url).toContain('entry.9=Fall%20Purge');
    const bare = prefilledLink('https://docs.google.com/forms/d/e/X/viewform', 'Fall Purge');
    expect(bare).toMatchObject({ tagged: false, url: 'https://docs.google.com/forms/d/e/X/viewform' });
    expect(bare.problem).toMatch(/SPRIGSALE/);
  });

  it('turns away links it can\'t tag: short links, edit links, and anything that is not a Google form', () => {
    expect(prefilledLink('https://forms.gle/abc123', 'x')).toMatchObject({ url: null, tagged: false });
    expect(prefilledLink('https://docs.google.com/forms/d/FORMID/edit', 'x').problem).toMatch(/editing/);
    expect(prefilledLink('https://example.com/form', 'x').url).toBeNull();
    expect(prefilledLink('   ', 'x').problem).toMatch(/Paste/);
  });

  it('lists the fields in the brief\'s set, with pickup ahead of the address so it can skip it', () => {
    const labels = formFields(room1()).map((f) => f.label);
    expect(labels).toEqual([
      'Sale name', 'Buyer Facebook name', 'Email', 'Shipped or local pickup', 'Ship to name', 'Street address', 'City', 'State', 'ZIP code', 'Payment method they will use', 'Note',
    ]);
    expect(formFields(room1()).find((f) => f.label.startsWith('Payment'))!.setup).toContain('PayPal Goods and Services, Venmo');
  });

  it('takes the payment choices from the room\'s own payment lines', () => {
    expect(paymentChoices('PayPal Goods and Services, Venmo @RowanEllery')).toEqual(['PayPal Goods and Services', 'Venmo @RowanEllery']);
    expect(paymentChoices('PayPal Friends and Family, tips welcome\nVenmo')).toEqual(['PayPal Friends and Family, tips welcome', 'Venmo']);
    expect(paymentChoices('  ')).toEqual([]);
  });

  it('carries the form link and the clock time in the closeout comment and each winner message, and in nothing else', () => {
    const url = 'https://docs.google.com/forms/d/e/X/viewform?entry.1=Fall';
    const by = saleTimeMs({ day: '2026-11-02', time: '21:00' });
    const comment = closeoutComment(sale(), room1(), url);
    expect(comment).toContain(url);
    expect(comment).toContain('Monday, November 2 at 9:00 PM Eastern');
    const [row] = buildCheckoutRows({ buyers: [buyer('Jada Winslow', 25)], match: matchResponses([], ['Jada Winslow'], 'x'), fulfillment: undefined, profile: room1(), deadline: { state: 'open', ms: by, hoursLeft: 4 } });
    const message = winnerMessage(row, sale(), room1(), url, by);
    expect(message).toContain(url);
    expect(message).toContain('Monday, November 2 at 9:00 PM Eastern');
    expect(message).toContain('Your total with shipping is $35.');
    expect(formReminder(row, room1(), url, by)).toContain(url);
    for (const text of [comment, message, formReminder(row, room1(), url, by)]) expect(DASH_PATTERN.test(text.replace(url, ''))).toBe(false);
  });
});

describe('the Pro explanation', () => {
  it('explains the chain in plain words, says no data touches us, and uses no dashes', () => {
    expect(PRO_PRIVACY).toMatch(/no server of ours/);
    expect(PRO_PRIVACY).toMatch(/no buyer data/);
    for (const text of [PRO_TITLE, PRO_PRIVACY, PRO_TEST_NOTE, ...PRO_POINTS]) expect(DASH_PATTERN.test(text)).toBe(false);
  });
});
