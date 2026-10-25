import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buyerKey } from '../core/buyers';
import { gatherLeftovers } from '../core/leftovers';
import { numberLots } from '../core/sale';
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
  closeSale(sale: Sale, winners: Omit<SaleRecord, 'id' | 'saleId' | 'date'>[], unclaimed: Lot[]): void;
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
        const waiting = gatherLeftovers(data.sales, data.records, data.leftoversDone);
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
      closeSale: (sale, winners, unclaimed) =>
        update((d) => {
          const date = toDay(new Date());
          const sold = new Set(plantIdsFor(sale, winners.map((w) => w.lotNumber)));
          return {
            records: [...winners.map((w) => ({ ...w, saleId: sale.id, date, id: newId() })), ...d.records],
            plants: d.plants.map((p) => (sold.has(p.id) ? { ...p, sold: true } : p)),
            sales: d.sales.map((s) => (s.id === sale.id ? { ...sale, closedAt: date, leftovers: unclaimed } : s)),
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
          const mine = (r: SaleRecord) => r.saleId === saleId && buyerKey(r.buyer) === k;
          // A buyer who never paid hands the plant back, so it shows as for sale again.
          const plantIds = new Set(plantIdsFor(d.sales.find((s) => s.id === saleId), d.records.filter(mine).map((r) => r.lotNumber)));
          return {
            records: d.records.map((r) => (mine(r) ? { ...r, payment } : r)),
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

export function useLeftovers() {
  const { sales, records, leftoversDone } = useStore();
  return useMemo(() => gatherLeftovers(sales, records, leftoversDone), [sales, records, leftoversDone]);
}

export function lotRecorded(records: SaleRecord[], saleId: string, lot: Lot): SaleRecord | undefined {
  return records.find((r) => r.saleId === saleId && r.lotNumber === lot.number);
}
