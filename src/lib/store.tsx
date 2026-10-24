import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { numberLots } from '../core/sale';
import { toDay } from '../core/text';
import type { Lot, Plant, Profile, Sale, SaleRecord } from '../core/types';
import { loadJson, saveJson } from './storage';

export const EMPTY_PROFILE: Profile = {
  sellerName: '',
  sellerNumber: '',
  shipping: '',
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
}

interface Store extends Data {
  saveProfile(profile: Profile): void;
  savePlant(plant: Plant): void;
  deletePlant(id: string): void;
  createSale(plantIds: string[], settings: Omit<Sale, 'id' | 'lots' | 'createdAt'>): Sale;
  saveSale(sale: Sale): void;
  deleteSale(id: string): void;
  recordSold(entry: Omit<SaleRecord, 'id'>, plantId?: string | null): void;
  deleteRecord(id: string): void;
}

const KEYS = { profile: 'profile.v1', plants: 'plants.v1', sales: 'sales.v1', records: 'records.v1' } as const;

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(() => ({
    profile: loadJson<Profile | null>(KEYS.profile, null),
    plants: loadJson<Plant[]>(KEYS.plants, []),
    sales: loadJson<Sale[]>(KEYS.sales, []),
    records: loadJson<SaleRecord[]>(KEYS.records, []),
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
      saveSale: (sale) => update((d) => ({ sales: d.sales.map((s) => (s.id === sale.id ? sale : s)) })),
      deleteSale: (id) => update((d) => ({ sales: d.sales.filter((s) => s.id !== id) })),
      recordSold: (entry, plantId) =>
        update((d) => ({
          records: [{ ...entry, id: newId() }, ...d.records],
          plants: plantId ? d.plants.map((p) => (p.id === plantId ? { ...p, sold: true } : p)) : d.plants,
        })),
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

export function lotRecorded(records: SaleRecord[], saleId: string, lot: Lot): SaleRecord | undefined {
  return records.find((r) => r.saleId === saleId && r.lotNumber === lot.number);
}
