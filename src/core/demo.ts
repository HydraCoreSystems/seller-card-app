import { toDay } from './text';
import type { Lot, Plant, Profile, Sale, SaleRecord } from './types';

/**
 * The sample showcase a new tester can open in one tap: an invented seller, invented buyers, a
 * Grower Showcase that ran last night, a few claims, one lot paid, one waiting, two leftovers,
 * and a little history so the record, totals, buyer memory and price memory have something to say.
 * Every name here is made up. None of it is ever written to the phone.
 */
export interface SampleData {
  profile: Profile;
  plants: Plant[];
  sales: Sale[];
  records: SaleRecord[];
  buyerNotes: Record<string, string>;
  leftoversDone: string[];
}

export const SAMPLE_SELLER = 'Rowan Ellery';
export const SAMPLE_SALE_ID = 'sample-showcase';

const SAMPLE_PLANTS: [id: string, name: string, noid: boolean, price: number, notes: string, sold: boolean][] = [
  ['sample-1', 'Hoya carnosa Krimson Queen', false, 25, 'Rooted, 6 leaves, new growth', true],
  ['sample-2', 'Hoya kerrii splash', false, 18, 'Single leaf cutting, rooted', true],
  ['sample-3', 'Hoya', true, 12, 'Big fuzzy leaves, no tag', false],
  ['sample-4', 'Dischidia ruscifolia', false, 15, '4 inch pot, trailing', false],
  ['sample-5', 'Hoya obovata', false, 20, 'Well rooted, 2 vines', false],
  ['sample-6', 'Hoya carnosa Krimson Queen', false, 28, 'Second cutting, 8 leaves', false],
  ['sample-7', 'Hoya linearis', false, 35, 'Hanging basket, long strands', false],
];

/** The comment thread as it copies off Facebook, so the claim tracker reads it like a real one. */
export function sampleThread(): string {
  return [
    'Most relevant',
    SAMPLE_SELLER, 'Author', 'Lot 1: Hoya carnosa Krimson Queen', '$25', 'Rooted, 6 leaves, new growth', '20h', 'Like', 'Reply',
    'Jada Winslow', 'Top fan', 'claim', '20h', 'Like', 'Reply',
    'Marcus Bell', 'claim if Jada passes', '20h', 'Like', 'Reply',
    SAMPLE_SELLER, 'Author', 'Lot 2: Hoya kerrii splash', '$18', 'Single leaf cutting, rooted', '20h', 'Like', 'Reply',
    'Marcus Bell', 'Claim!!', '20h', 'Like', 'Reply',
    SAMPLE_SELLER, 'Author', 'Lot 3: Hoya NOID', '$12', 'Big fuzzy leaves, no tag', '20h', 'Like', 'Reply',
    'Priya Lund', 'so pretty, does it come potted?', '19h', 'Like', 'Reply',
    SAMPLE_SELLER, 'Author', 'Lot 4: Dischidia ruscifolia', '$15', '4 inch pot, trailing', '20h', 'Like', 'Reply',
  ].join('\n');
}

const lotOf = (p: Plant, number: number): Lot => ({
  number, plantId: p.id, name: p.name, noid: p.noid, price: p.price, description: p.notes, photoUri: null,
});

export function sampleData(now = new Date()): SampleData {
  const day = (back: number) => toDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back));
  const today = day(0);
  const plants: Plant[] = SAMPLE_PLANTS.map(([id, name, noid, price, notes, sold]) => ({
    id, name, noid, price, notes, sold, kind: 'sale', photoUri: null, createdAt: day(9),
  }));
  const lots = plants.slice(0, 4).map((p, i) => lotOf(p, i + 1));
  const sale: Sale = {
    id: SAMPLE_SALE_ID,
    formatId: 'generic',
    kind: 'sale',
    opens: { day: day(1), time: '19:00' },
    closes: null,
    closeCall: '',
    claimRules: 'First clear claim wins. Pay within 24 hours.',
    crossListing: '',
    lots,
    claimText: sampleThread(),
    closedAt: today,
    // Closed a few hours ago, so the pay window is still open and the reminder shows its pay by line.
    closedMs: now.getTime() - 3 * 3_600_000,
    leftovers: lots.slice(2),
    shippingCharge: 10,
    claimOrder: { 1: ['Jada Winslow', 'Marcus Bell'], 2: ['Marcus Bell'] },
    createdAt: day(2),
  };
  const record = (id: string, r: Omit<SaleRecord, 'id'>): SaleRecord => ({ id, ...r });
  const records: SaleRecord[] = [
    record('sample-r1', { saleId: SAMPLE_SALE_ID, lotNumber: 1, plantName: lots[0].name, buyer: 'Jada Winslow', price: 25, date: today, payment: 'paid', paidDate: today }),
    record('sample-r2', { saleId: SAMPLE_SALE_ID, lotNumber: 2, plantName: lots[1].name, buyer: 'Marcus Bell', price: 18, date: today }),
    // A little history from earlier showcases, entered by hand.
    record('sample-r3', { saleId: null, lotNumber: null, plantName: 'Hoya carnosa Krimson Queen', buyer: 'Jada Winslow', price: 22, date: day(30), payment: 'paid', paidDate: day(30) }),
    record('sample-r4', { saleId: null, lotNumber: null, plantName: 'Hoya pubicalyx', buyer: 'Theo Marsh', price: 16, date: day(30), payment: 'paid', paidDate: day(29) }),
    record('sample-r5', { saleId: null, lotNumber: null, plantName: 'Hoya obovata', buyer: 'Priya Lund', price: 19, date: day(45), payment: 'paid', paidDate: day(45) }),
  ];
  return {
    profile: {
      sellerName: SAMPLE_SELLER,
      sellerNumber: '27',
      shipping: 'USPS Priority, $10 flat',
      shippingDays: [1, 3],
      payment: 'PayPal Goods and Services, Venmo @RowanEllery',
      timeZone: 'Central',
      claimRules: 'First clear claim wins. Pay within 24 hours.',
      defaultFormat: 'generic',
      payWindowHours: 24,
    },
    plants,
    sales: [sale],
    records,
    buyerNotes: { jadawinslow: 'Pays the same night. Likes carnosas.' },
    leftoversDone: [],
  };
}
