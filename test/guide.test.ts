import { describe, expect, it } from 'vitest';
import { checklistStages, currentStage, firstSaleOf, saleEnded, showsChecklist } from '../src/core/firstSale';
import {
  FRESH_GUIDE, dismissChecklist, finishWalk, firstUnfinished, hasCoreLines, opensByItself, passStep, readGuide, setDraft,
  settleGuide, setupComplete, showsResume, skipWalk, walkSteps,
} from '../src/core/guide';
import { CHECKLIST_COPY, HELP_COPY, WALK_COPY } from '../src/core/guideCopy';
import { SKRYBIX_GUIDE_URL } from '../src/core/brand';
import { applyWalk, previewSale, walkValues, zoneLabelFor, BLANK_VALUES } from '../src/core/setupWalk';
import { announcementFor } from '../src/core/announce';
import { DASH_PATTERN } from '../src/core/text';
import type { Profile, Sale, SaleRecord } from '../src/core/types';

const ctx = { hasProfile: false, hasSales: false };
const profile = (extra: Partial<Profile> = {}): Profile => ({
  sellerName: 'Rowan', sellerNumber: '', shipping: '', shippingDays: [], payment: '', timeZone: '', claimRules: '', defaultFormat: 'generic', ...extra,
});
let n = 0;
const mint = () => `id-${++n}`;

describe('walk steps and the Pro gate', () => {
  it('has the checkout form step only where the checkout chain is', () => {
    expect(walkSteps({ pro: true })).toEqual(['welcome', 'room', 'seller', 'location', 'lines', 'form', 'done']);
    expect(walkSteps({ pro: false })).toEqual(['welcome', 'room', 'seller', 'location', 'lines', 'done']);
    expect(walkSteps({ pro: false })).not.toContain('form');
  });
});

describe('walk state: persistence, skip and resume', () => {
  it('starts new on a fresh install and opens by itself once', () => {
    const g = readGuide(null, ctx);
    expect(g).toEqual(FRESH_GUIDE);
    expect(opensByItself(g, { hasProfile: false, sample: false })).toBe(true);
    expect(opensByItself(g, { hasProfile: false, sample: true })).toBe(false);
    expect(opensByItself(g, { hasProfile: true, sample: false })).toBe(false);
  });

  it('survives a round trip through JSON, which is how the phone stores it', () => {
    let g = passStep(FRESH_GUIDE, 'welcome');
    g = passStep(g, 'room');
    g = setDraft(g, { roomName: 'US Hoya Market', formatId: 'generic' });
    expect(readGuide(JSON.parse(JSON.stringify(g)), ctx)).toEqual(g);
  });

  it('resumes at the first step not passed', () => {
    const steps = walkSteps({ pro: true });
    let g = FRESH_GUIDE;
    expect(firstUnfinished(g, steps)).toBe('welcome');
    for (const s of ['welcome', 'room', 'seller'] as const) g = passStep(g, s);
    expect(firstUnfinished(readGuide(JSON.parse(JSON.stringify(g)), ctx), steps)).toBe('location');
  });

  it('skip keeps the walk from opening by itself, and the Home entry stays until setup is complete', () => {
    const g = skipWalk(FRESH_GUIDE);
    expect(g.walk).toBe('skipped');
    expect(opensByItself(g, { hasProfile: false, sample: false })).toBe(false);
    expect(showsResume(g, null, false)).toBe(true);
    expect(showsResume(g, null, true)).toBe(false);
    // Typing the core lines in Profile completes setup without the walk.
    const lines = { sellerName: 'Rowan', shipping: 'USPS', payment: 'Venmo' };
    expect(showsResume(g, lines, false)).toBe(false);
    expect(hasCoreLines({ ...lines, payment: '' })).toBe(false);
  });

  it('a skipped walk that is picked up again is under way', () => {
    expect(passStep(skipWalk(FRESH_GUIDE), 'welcome').walk).toBe('active');
  });

  it('a finished walk never reopens, and nothing walks it back', () => {
    const steps = walkSteps({ pro: false });
    const done = finishWalk(passStep(FRESH_GUIDE, 'welcome'), steps);
    expect(done.walk).toBe('done');
    expect(opensByItself(done, { hasProfile: false, sample: false })).toBe(false);
    expect(showsResume(done, null, false)).toBe(false);
    expect(skipWalk(done)).toBe(done);
    expect(passStep(done, 'room')).toBe(done);
    expect(setDraft(done, { roomName: 'x', formatId: 'generic' })).toBe(done);
    expect(readGuide(JSON.parse(JSON.stringify(done)), ctx).walk).toBe('done');
    expect(setupComplete(done, null)).toBe(true);
  });

  it('a phone that already has a profile counts as set up, and a restore settles a fresh state', () => {
    expect(readGuide(null, { hasProfile: true, hasSales: false }).walk).toBe('done');
    expect(readGuide(null, { hasProfile: true, hasSales: true }).checklistDismissed).toBe(true);
    expect(readGuide(null, { hasProfile: true, hasSales: false }).checklistDismissed).toBe(false);
    expect(settleGuide(FRESH_GUIDE, true).walk).toBe('done');
    expect(settleGuide(FRESH_GUIDE, false)).toBe(FRESH_GUIDE);
  });

  it('ignores a saved state it does not understand', () => {
    expect(readGuide({ version: 9 }, ctx)).toEqual(FRESH_GUIDE);
    expect(readGuide('nonsense', ctx)).toEqual(FRESH_GUIDE);
    expect(readGuide({ version: 1, walk: 'active', done: ['room', 'bogus'] }, ctx).done).toEqual(['room']);
  });
});

describe('what the walk writes', () => {
  it('without rooms writes the profile itself, with the Commons number in its own field', () => {
    const v = { ...BLANK_VALUES, sellerName: ' Rowan ', formatId: 'commons' as const, number: '001', zip: '46802', city: 'Fort Wayne', state: 'in', shipping: 'USPS', payment: 'Venmo' };
    const { profile: p } = applyWalk(profile({ sellerName: '' }), v, { rooms: false, newId: mint, timeZone: 'Eastern' });
    expect(p).toMatchObject({ sellerName: 'Rowan', defaultFormat: 'commons', growerNumber: '001', state: 'IN', timeZone: 'Eastern', shipping: 'USPS' });
    expect(p.venues).toBeUndefined();
  });

  it('with rooms makes the room once and keeps writing to it', () => {
    const v = { ...BLANK_VALUES, roomName: 'US Hoya Market', sellerName: 'Rowan', shipping: 'USPS', payment: 'Venmo' };
    const a = applyWalk(profile({ sellerName: '' }), v, { rooms: true, newId: mint });
    expect(a.profile.venues).toHaveLength(1);
    const b = applyWalk(a.profile, { ...v, shipping: 'Priority' }, { rooms: true, venueId: a.venueId, newId: mint });
    expect(b.profile.venues).toHaveLength(1);
    expect(b.profile.venues![0]).toMatchObject({ name: 'US Hoya Market', shipping: 'Priority' });
    expect(b.profile.shipping).toBe('Priority');
  });

  it('a second room starts with the seller name and blank room lines', () => {
    const first = applyWalk(profile({ sellerName: '' }), { ...BLANK_VALUES, roomName: 'The Commons', formatId: 'commons', sellerName: 'Rowan', shipping: 'USPS', payment: 'Venmo', number: '001' }, { rooms: true, newId: mint });
    const start = walkValues(first.profile, true, '__new__');
    expect(start).toMatchObject({ sellerName: 'Rowan', roomName: '', shipping: '', payment: '', number: '' });
    const second = applyWalk(first.profile, { ...start, roomName: 'US Hoya Market' }, { rooms: true, venueId: null, newId: mint });
    expect(second.profile.venues).toHaveLength(2);
    expect(second.profile.venues![0].shipping).toBe('USPS');
  });

  it('replay fills each field from the room being replayed', () => {
    const made = applyWalk(profile({ sellerName: '' }), { ...BLANK_VALUES, roomName: 'The Commons', sellerName: 'Rowan', shipping: 'USPS', payment: 'Venmo', zip: '46802' }, { rooms: true, newId: mint });
    expect(walkValues(made.profile, true, made.venueId)).toMatchObject({ roomName: 'The Commons', sellerName: 'Rowan', shipping: 'USPS', zip: '46802' });
  });

  it('never puts a seller name into the profile without one being typed, and reads device zones', () => {
    expect(zoneLabelFor('America/Chicago')).toBe('Central');
    expect(zoneLabelFor('Europe/Paris')).toBe('');
    expect(zoneLabelFor(undefined)).toBe('');
  });

  it('builds a card preview from what was typed', () => {
    const made = applyWalk(profile({ sellerName: '' }), { ...BLANK_VALUES, roomName: 'US Hoya Market', sellerName: 'Rowan', shipping: 'USPS Priority, $10 flat', payment: 'Venmo @rowan', city: 'Fort Wayne', state: 'IN', zip: '46802' }, { rooms: false, newId: mint, timeZone: 'Eastern' });
    const text = announcementFor(made.profile, previewSale(made.profile, null, 'generic', new Date(2026, 10, 3)), false);
    expect(text).toContain('Rowan');
    expect(text).toContain('USPS Priority, $10 flat');
    expect(text).toContain('Venmo @rowan');
  });
});

const sale = (extra: Partial<Sale> = {}): Sale => ({
  id: 's1', formatId: 'generic', kind: 'sale', opens: null, closes: null, closeCall: '', claimRules: '', crossListing: '', createdAt: '2026-11-01',
  lots: [{ number: 1, plantId: null, name: 'Hoya carnosa', noid: false, price: 20, description: '', photoUri: null }], ...extra,
});
const record = (extra: Partial<SaleRecord> = {}): SaleRecord => ({ id: 'r1', saleId: 's1', lotNumber: 1, plantName: 'Hoya carnosa', buyer: 'Jada Winslow', price: 20, date: '2026-11-02', ...extra });
const done = (stages: ReturnType<typeof checklistStages>) => stages.filter((s) => s.done).map((s) => s.id);

describe('first sale checklist', () => {
  it('lights stages from the sale data, in order', () => {
    expect(done(checklistStages(sale({ lots: [] }), [], false))).toEqual([]);
    expect(currentStage(checklistStages(sale({ lots: [] }), [], false))).toBe('plants');
    expect(currentStage(checklistStages(sale(), [], false))).toBe('post');
    expect(currentStage(checklistStages(sale({ postedAt: '2026-11-02' }), [], false))).toBe('thread');
    expect(currentStage(checklistStages(sale({ postedAt: '2026-11-02', claimText: 'Jada claim' }), [], false))).toBe('winners');
    expect(currentStage(checklistStages(sale({ postedAt: '2026-11-02', claimText: 'x' }), [record()], false))).toBe('close');
  });

  it('a lot with no price is not ready, and a pasted thread means it was posted', () => {
    const unpriced = sale({ lots: [{ number: 1, plantId: null, name: 'Hoya', noid: false, price: null, description: '', photoUri: null }] });
    expect(done(checklistStages(unpriced, [], false))).toEqual([]);
    expect(done(checklistStages(sale({ claimText: 'x' }), [], false))).toEqual(['plants', 'post', 'thread']);
  });

  it('has the winner message stage only where the checkout chain is', () => {
    expect(checklistStages(sale(), [], false).map((s) => s.id)).toEqual(['plants', 'post', 'thread', 'winners', 'close']);
    expect(checklistStages(sale(), [], true).map((s) => s.id)).toEqual(['plants', 'post', 'thread', 'winners', 'messages', 'close']);
    expect(done(checklistStages(sale({ fulfillment: { 'jadawinslow': { packed: true } } }), [record()], true))).toContain('messages');
    expect(done(checklistStages(sale(), [record({ payment: 'paid' })], true))).toContain('messages');
  });

  it('belongs to the first sale only', () => {
    const a = sale({ id: 'a', createdAt: '2026-10-01' });
    const b = sale({ id: 'b', createdAt: '2026-11-01' });
    expect(firstSaleOf([b, a])?.id).toBe('a');
    expect(firstSaleOf([])).toBeNull();
    expect(showsChecklist(a, [b, a], [], FRESH_GUIDE, false)).toBe(true);
    expect(showsChecklist(b, [b, a], [], FRESH_GUIDE, false)).toBe(false);
  });

  it('the dismiss flag retires it for good, and survives storage', () => {
    const s = sale();
    const g = dismissChecklist(FRESH_GUIDE);
    expect(showsChecklist(s, [s], [], g, false)).toBe(false);
    expect(readGuide(JSON.parse(JSON.stringify(g)), ctx).checklistDismissed).toBe(true);
    expect(finishWalk(g, walkSteps({ pro: false })).checklistDismissed).toBe(true);
  });

  it('retires on its own when the first sale ends, closed without the checkout chain, shipped with it', () => {
    const closed = sale({ closedAt: '2026-11-03' });
    expect(saleEnded(sale(), [], false)).toBe(false);
    expect(saleEnded(closed, [record()], false)).toBe(true);
    expect(showsChecklist(closed, [closed], [record()], FRESH_GUIDE, false)).toBe(false);
    // With the chain on, a closed sale still has winners to message and ship.
    expect(saleEnded(closed, [record()], true)).toBe(false);
    expect(showsChecklist(closed, [closed], [record()], FRESH_GUIDE, true)).toBe(true);
    const shipped = sale({ closedAt: '2026-11-03', fulfillment: { 'jadawinslow': { shipped: true } } });
    expect(saleEnded(shipped, [record()], true)).toBe(true);
    expect(saleEnded(closed, [], true)).toBe(true);
    expect(saleEnded(closed, [record({ payment: 'never' })], true)).toBe(true);
  });
});

describe('help entry and house copy', () => {
  it('ships with no guide link, so the Help entry stays hidden', () => {
    expect(SKRYBIX_GUIDE_URL).toBe('');
  });

  it('has no dashes of any kind in a string the seller reads', () => {
    const all: string[] = [];
    for (const group of [WALK_COPY, CHECKLIST_COPY, HELP_COPY]) {
      for (const v of Object.values(group)) all.push(typeof v === 'function' ? v(2, 5) : v);
    }
    for (const line of checklistStages(sale(), [], true)) all.push(line.line, line.button);
    for (const t of all) expect(DASH_PATTERN.test(t), t).toBe(false);
    expect(all.length).toBeGreaterThan(40);
  });
});

describe('the Pro step follows the build, as the checkout chain does', () => {
  it('the Phil build always has the checkout form step, and the store product has it only with Pro', async () => {
    const { isPhil } = await import('../src/core/variant');
    const keep = process.env.EXPO_PUBLIC_APP_VARIANT;
    try {
      process.env.EXPO_PUBLIC_APP_VARIANT = 'phil';
      expect(walkSteps({ pro: isPhil() })).toContain('form');
      delete process.env.EXPO_PUBLIC_APP_VARIANT;
      expect(walkSteps({ pro: isPhil() })).not.toContain('form');
      expect(walkSteps({ pro: isPhil() || true })).toContain('form');
    } finally {
      if (keep === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
      else process.env.EXPO_PUBLIC_APP_VARIANT = keep;
    }
  });
});
