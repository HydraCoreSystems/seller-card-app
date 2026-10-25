import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buyerKey } from '../core/buyers';
import { flatShipping } from '../core/chase';
import { gatherLeftovers } from '../core/leftovers';
import { numberLots } from '../core/sale';
import { markPayment } from '../core/records';
import { DEFAULT_PAY_WINDOW, applyOffer, applySettle, windowMs } from '../core/secondChance';
import { toDay } from '../core/text';
import type { Lot, Plant, Profile, Sale, SaleRecord } from '../core/types';
import { loadJson, saveJson } from './storage';

export const EMPTY_PROFILE: Profile = {
  sellerName: '',
  sellerNumber: '',
  shipping: '',
  shippingDays: [],
  payment: '',
  timeZone: '',
  claimRules: '',
  defaultFormat: 'generic',
  payWindowHours: DEFAULT_PAY_WINDOW,
};

interface Data {
  profile: Profile | null;
  plants: Plant[];
  sales: Sale[];
  records: SaleRecord[];
  /** One short note per buyer, keyed by buyerKey. */
  buyerNotes: Record<string, string>;
  /** Leftovers the seller removed or relisted. */
  leftoversDone: string[];
}

type SaleSettings = Omit<Sale, 'id' | 'lots' | 'createdAt'>;

interface Store extends Data {
  saveProfile(profile: Profile): void;
  savePlant(plant: Plant): void;
  deletePlant(id: string): void;
  createSale(plantIds: string[], settings: SaleSettings): Sale;
  /** A new sale from leftovers, renumbered in the order given. */
  relistLeftovers(keys: string[], settings: SaleSettings): Sale;
  removeLeftover(key: string): void;
  saveSale(sale: Sale): void;
  /** Marks the winners sold, keeps the unclaimed lots as leftovers, and stamps the close date. */
  closeSale(
    sale: Sale,
    winners: Omit<SaleRecord, 'id' | 'saleId' | 'date'>[],
    unclaimed: Lot[],
    claimOrder: Record<number, string[]>,
  ): void;
  /** Takes the lot off the winner who didn't pay and offers it to the runner up, or sends it back to open when there's none. */
  sendSecondChance(saleId: string, lot: number, from: string, to: string | null): void;
  /** The runner up took it, so it's theirs; or they passed, so it's open again. */
  settleSecondChance(saleId: string, lot: number, outcome: 'took' | 'passed'): void;
  deleteSale(id: string): void;
  recordSold(entry: Omit<SaleRecord, 'id'>, plantId?: string | null): void;
  /** Paid, never paid, or back to waiting, for every lot one buyer won in one sale. */
  setPayment(saleId: string, buyer: string, payment: SaleRecord['payment']): void;
  saveBuyerNote(buyer: string, note: string): void;
  deleteRecord(id: string): void;
}

const KEYS = {
  profile: 'profile.v1',
  plants: 'plants.v1',
  sales: 'sales.v1',
  records: 'records.v1',
  buyerNotes: 'buyerNotes.v1',
  leftoversDone: 'leftoversDone.v1',
} as const;

/** The plants behind some of a sale's lots, so a record can find its plant. */
function plantIdsFor(sale: Sale | undefined, lotNumbers: (number | null)[]): string[] {
  return lotNumbers.map((n) => sale?.lots.find((l) => l.number === n)?.plantId).filter((p): p is string => !!p);
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(() => ({
    // Merged with EMPTY_PROFILE so a profile saved before a new field existed still gets a default for it.
    profile: (() => {
      const saved = loadJson<Profile | null>(KEYS.profile, null);
      return saved ? { ...EMPTY_PROFILE, ...saved } : null;
    })(),
    plants: loadJson<Plant[]>(KEYS.plants, []),
    sales: loadJson<Sale[]>(KEYS.sales, []),
    records: loadJson<SaleRecord[]>(KEYS.records, []),
    buyerNotes: loadJson<Record<string, string>>(KEYS.buyerNotes, {}),
    leftoversDone: loadJson<string[]>(KEYS.leftoversDone, []),
  }));
  const last = useRef(data);

  useEffect(() => {
    for (const key of Object.keys(KEYS) as (keyof Data)[]) {
      if (data[key] !== last.current[key]) saveJson(KEYS[key], data[key]);
    }
    last.current = data;
  }, [data]);

  const update = useCallback((fn: (d: Data) => Partial<Data>) => setData((d) => ({ ...d, ...fn(d) })), []);

  const store = useMemo<Store>(
    () => ({
      ...data,
      saveProfile: (profile) => update(() => ({ profile })),
      savePlant: (plant) =>
        update((d) => ({
          plants: d.plants.some((p) => p.id === plant.id)
            ? d.plants.map((p) => (p.id === plant.id ? plant : p))
            : [...d.plants, plant],
        })),
      deletePlant: (id) => update((d) => ({ plants: d.plants.filter((p) => p.id !== id) })),
      createSale: (plantIds, settings) => {
        const picked = plantIds
          .map((id) => data.plants.find((p) => p.id === id))
          .filter((p): p is Plant => !!p);
        const sale: Sale = { ...settings, id: newId(), lots: numberLots(picked), createdAt: toDay(new Date()) };
        update((d) => ({ sales: [sale, ...d.sales] }));
        return sale;
      },
      relistLeftovers: (keys, settings) => {
        const waiting = gatherLeftovers(data.sales, data.records, data.leftoversDone, { window: windowMs(data.profile) });
        const lots = keys
          .map((k) => waiting.find((l) => l.key === k))
          .filter((l) => !!l)
          .map((l, i) => ({ ...l.lot, number: i + 1 }));
        const sale: Sale = { ...settings, id: newId(), lots, createdAt: toDay(new Date()) };
        update((d) => ({ sales: [sale, ...d.sales], leftoversDone: [...d.leftoversDone, ...keys] }));
        return sale;
      },
      removeLeftover: (key) => update((d) => ({ leftoversDone: [...d.leftoversDone, key] })),
      saveSale: (sale) => update((d) => ({ sales: d.sales.map((s) => (s.id === sale.id ? sale : s)) })),
      closeSale: (sale, winners, unclaimed, claimOrder) =>
        update((d) => {
          const date = toDay(new Date());
          const sold = new Set(plantIdsFor(sale, winners.map((w) => w.lotNumber)));
          const closed = {
            ...sale,
            closedAt: date,
            closedMs: Date.now(),
            leftovers: unclaimed,
            claimOrder,
            shippingCharge: flatShipping(d.profile?.shipping ?? ''),
          };
          return {
            records: [...winners.map((w) => ({ ...w, saleId: sale.id, date, id: newId() })), ...d.records],
            plants: d.plants.map((p) => (sold.has(p.id) ? { ...p, sold: true } : p)),
            sales: d.sales.map((s) => (s.id === sale.id ? closed : s)),
          };
        }),
      sendSecondChance: (saleId, lot, from, to) =>
        update((d) => {
          const sale = d.sales.find((s) => s.id === saleId);
          if (!sale) return {};
          const next = applyOffer(sale, d.records, { lot, from, to, now: Date.now() });
          // The plant is back in play: offered on, or open again.
          const back = new Set(plantIdsFor(sale, [lot]));
          return {
            records: next.records,
            sales: d.sales.map((s) => (s.id === saleId ? next.sale : s)),
            plants: d.plants.map((p) => (back.has(p.id) ? { ...p, sold: false } : p)),
          };
        }),
      settleSecondChance: (saleId, lot, outcome) =>
        update((d) => {
          const sale = d.sales.find((s) => s.id === saleId);
          if (!sale) return {};
          const next = applySettle(sale, d.records, { lot, outcome, id: newId(), date: toDay(new Date()) });
          const sold = new Set(outcome === 'took' ? plantIdsFor(sale, [lot]) : []);
          return {
            records: next.records,
            sales: d.sales.map((s) => (s.id === saleId ? next.sale : s)),
            plants: d.plants.map((p) => (sold.has(p.id) ? { ...p, sold: true } : p)),
          };
        }),
      deleteSale: (id) => update((d) => ({ sales: d.sales.filter((s) => s.id !== id) })),
      recordSold: (entry, plantId) =>
        update((d) => ({
          records: [{ ...entry, id: newId() }, ...d.records],
          plants: plantId ? d.plants.map((p) => (p.id === plantId ? { ...p, sold: true } : p)) : d.plants,
        })),
      setPayment: (saleId, buyer, payment) =>
        update((d) => {
          const k = buyerKey(buyer);
          const sale = d.sales.find((s) => s.id === saleId);
          // Lots already passed on to the next in line stay never paid whatever the buyer does now.
          const passedOn = (r: SaleRecord) => sale?.offers?.some((o) => o.lot === r.lotNumber && buyerKey(o.from) === k);
          const mine = (r: SaleRecord) => r.saleId === saleId && buyerKey(r.buyer) === k && !passedOn(r);
          // A buyer who never paid hands the plant back, so it shows as for sale again.
          const plantIds = new Set(plantIdsFor(d.sales.find((s) => s.id === saleId), d.records.filter(mine).map((r) => r.lotNumber)));
          return {
            records: d.records.map((r) => (mine(r) ? markPayment(r, payment, toDay(new Date())) : r)),
            plants: d.plants.map((p) => (plantIds.has(p.id) ? { ...p, sold: payment !== 'never' } : p)),
          };
        }),
      saveBuyerNote: (buyer, note) =>
        update((d) => {
          const notes = { ...d.buyerNotes };
          if (note.trim()) notes[buyerKey(buyer)] = note.trim();
          else delete notes[buyerKey(buyer)];
          return { buyerNotes: notes };
        }),
      deleteRecord: (id) => update((d) => ({ records: d.records.filter((r) => r.id !== id) })),
    }),
    [data, update],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export function useSale(id: string | undefined): Sale | undefined {
  const { sales } = useStore();
  return sales.find((s) => s.id === id);
}

/** The clock, ticking once a minute, so payment windows run out on screen without a reload. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function useLeftovers() {
  const { sales, records, leftoversDone, profile } = useStore();
  const now = useNow();
  return useMemo(
    () => gatherLeftovers(sales, records, leftoversDone, { window: windowMs(profile), now }),
    [sales, records, leftoversDone, profile, now],
  );
}

export function lotRecorded(records: SaleRecord[], saleId: string, lot: Lot): SaleRecord | undefined {
  return records.find((r) => r.saleId === saleId && r.lotNumber === lot.number);
}
