import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buyerKey } from '../core/buyers';
import type { BackupData } from '../core/backup';
import { sampleData } from '../core/demo';
import { flatShipping } from '../core/chase';
import { gatherLeftovers } from '../core/leftovers';
import { numberLots } from '../core/sale';
import { plantsOnList, type SheetLot } from '../core/saleSheet';
import { applyFulfillment, applyPayment, plantIdsFor } from '../core/mutations';
import { DEFAULT_PAY_WINDOW, applyOffer, applySettle, windowMs } from '../core/secondChance';
import { toDay } from '../core/text';
import type { CheckoutResponse, Fulfillment, Lot, Plant, Profile, Sale, SaleRecord, SaleTemplate } from '../core/types';
import { resolveProfile, venuesOf, withVenues } from '../core/venues';
import { readGuide, type GuideState } from '../core/guide';
import { readSettings, type Settings } from '../core/settings';
import { setStampStyle } from './stampSettings';
import { isPhil } from '../core/variant';
import { cachedPro, startIap } from './iap';
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
  /** Saved sale settings, for sellers with a standing way of opening a sale. */
  templates: SaleTemplate[];
  /** The setup walk and first sale checklist state. Stays on the phone and is not part of a backup. */
  guide: GuideState;
  /** What the seller chose in Settings: the watermark and what a new card starts with. */
  settings: Settings;
  /** True when the checkout chain is on: always in the Phil build, and in the store product while a Pro subscription is active. Never saved here; the store is asked. */
  pro: boolean;
}

type SaleSettings = Omit<Sale, 'id' | 'lots' | 'createdAt'>;

interface Store extends Data {
  /** True while the sample showcase is open. Nothing is saved to the phone until the seller leaves it. */
  sample: boolean;
  /** Swaps in the sample showcase, keeping the seller's own data aside, untouched. */
  openSample(): void;
  /** Drops the sample and brings the seller's own data back. */
  leaveSample(): void;
  /** Replaces everything the seller keeps with the contents of a backup. Pro is not part of a backup, so it stays as it is. */
  restoreData(restored: BackupData): void;
  saveProfile(profile: Profile): void;
  /** Changes the guide state. */
  updateGuide(fn: (g: GuideState) => GuideState): void;
  /** Changes Settings. */
  updateSettings(fn: (s: Settings) => Settings): void;
  savePlant(plant: Plant): void;
  deletePlant(id: string): void;
  createSale(plantIds: string[], settings: SaleSettings): Sale;
  /** A new sale from leftovers, renumbered in the order given. */
  relistLeftovers(keys: string[], settings: SaleSettings): Sale;
  /** A new sale from Sale Sheet rows, numbered as listed. Each row joins the plant list unless it's already there. */
  importSale(rows: SheetLot[], settings: SaleSettings): Sale;
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
  saveTemplate(template: SaleTemplate): void;
  deleteTemplate(id: string): void;
  /** Keeps the responses read from the seller's checkout sheet on the sale. Earlier hand pairings stay. */
  importCheckout(saleId: string, responses: CheckoutResponse[]): void;
  /** Pairs a response with a winner the seller picked, or clears the pairing. */
  linkResponse(saleId: string, row: number, buyerKey: string | null): void;
  /** Packing and shipping marks for one buyer in one sale. */
  setFulfillment(saleId: string, buyerKey: string, patch: Partial<Fulfillment>): void;
}

const KEYS = {
  profile: 'profile.v1',
  plants: 'plants.v1',
  sales: 'sales.v1',
  records: 'records.v1',
  buyerNotes: 'buyerNotes.v1',
  leftoversDone: 'leftoversDone.v1',
  templates: 'templates.v1',
  guide: 'guide.v1',
  settings: 'settings.v1',
} as const;

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(() => ({
    // Merged with EMPTY_PROFILE so a profile saved before a new field existed still gets a default for it.
    profile: (() => {
      const saved = loadJson<Profile | null>(KEYS.profile, null);
      if (!saved) return null;
      // Before the grower number had its own field, a Commons seller's seller number stood in for it.
      const growerNumber = saved.growerNumber ?? (saved.defaultFormat === 'commons' ? saved.sellerNumber : '');
      const merged = { ...EMPTY_PROFILE, ...saved, growerNumber };
      // Before rooms existed, the profile's own lines stood for the one room. Make that room.
      // The closed test build has no rooms, so its saved profile is left exactly as it was.
      if (!isPhil()) return merged;
      return merged.venues?.length ? merged : withVenues(merged, venuesOf(merged), merged.defaultVenueId ?? 'venue-1');
    })(),
    plants: loadJson<Plant[]>(KEYS.plants, []),
    sales: loadJson<Sale[]>(KEYS.sales, []),
    records: loadJson<SaleRecord[]>(KEYS.records, []),
    buyerNotes: loadJson<Record<string, string>>(KEYS.buyerNotes, {}),
    leftoversDone: loadJson<string[]>(KEYS.leftoversDone, []),
    templates: loadJson<SaleTemplate[]>(KEYS.templates, []),
    guide: readGuide(loadJson<unknown>(KEYS.guide, null), {
      hasProfile: !!loadJson<Profile | null>(KEYS.profile, null),
      hasSales: loadJson<Sale[]>(KEYS.sales, []).length > 0,
    }),
    settings: readSettings(loadJson<unknown>(KEYS.settings, null)),
    // The Phil build has Pro unlocked, with no gate and no switch. The store product starts from the last
    // paid answer it saw, so Pro stays on with no signal, and the store corrects it in a moment.
    pro: isPhil() || cachedPro(),
  }));
  const last = useRef(data);
  // The seller's own data, set aside while the sample is open.
  const [ownData, setOwnData] = useState<Data | null>(null);
  const sample = ownData !== null;

  useEffect(() => {
    // The sample lives in memory only, so the phone always holds the seller's own data.
    if (!sample) {
      for (const key of Object.keys(KEYS) as (keyof typeof KEYS)[]) {
        if (data[key] !== last.current[key]) saveJson(KEYS[key], data[key]);
      }
    }
    last.current = data;
  }, [data, sample]);

  const update = useCallback((fn: (d: Data) => Partial<Data>) => setData((d) => ({ ...d, ...fn(d) })), []);

  // In the store product, Pro follows the Apple subscription. The Phil build never opens the store.
  useEffect(() => {
    if (isPhil()) return;
    return startIap((on) => setData((d) => (d.pro === on ? d : { ...d, pro: on })));
  }, []);

  // Stamped photos are made anywhere in the app, so the watermark style is kept where they can read it.
  setStampStyle(data.settings.stamp);
  const store = useMemo<Store>(
    () => ({
      ...data,
      sample,
      openSample: () => {
        if (sample) return;
        setOwnData(data);
        setData({ ...sampleData(), templates: [], pro: data.pro, guide: data.guide, settings: data.settings });
      },
      leaveSample: () => {
        if (!ownData) return;
        // Marked as already saved, so leaving writes nothing.
        last.current = ownData;
        setData({ ...ownData, pro: data.pro });
        setOwnData(null);
      },
      restoreData: (restored) => {
        // The sample is in memory only, and restoring over it would lose the seller's own data set aside.
        if (sample) return;
        update(() => ({ ...restored, profile: restored.profile ? { ...EMPTY_PROFILE, ...restored.profile } : null }));
      },
      saveProfile: (profile) => update(() => ({ profile })),
      updateGuide: (fn) => update((d) => ({ guide: fn(d.guide) })),
      updateSettings: (fn) => update((d) => ({ settings: fn(d.settings) })),
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
      importSale: (rows, settings) => {
        // A row naming a plant already on the list, still for sale, uses that plant and its photo.
        const onList = plantsOnList(data.plants, rows);
        const today = toDay(new Date());
        const added: Plant[] = [];
        const lots: Lot[] = rows.map((r, i) => {
          let plant = onList[i];
          if (!plant) {
            plant = { id: newId(), name: r.name, noid: r.noid, price: r.price, kind: settings.kind, photoUri: null, notes: r.description, sold: false, createdAt: today };
            added.push(plant);
          }
          return { number: i + 1, plantId: plant.id, name: r.name, noid: r.noid, price: r.price, description: r.description, photoUri: plant.photoUri };
        });
        const sale: Sale = { ...settings, id: newId(), lots, createdAt: today };
        update((d) => ({ sales: [sale, ...d.sales], plants: [...d.plants, ...added] }));
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
            shippingCharge: flatShipping(d.profile ? resolveProfile(d.profile, sale).shipping : ''),
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
      setPayment: (saleId, buyer, payment) => update((d) => applyPayment(d, saleId, buyer, payment, toDay(new Date()))),
      saveBuyerNote: (buyer, note) =>
        update((d) => {
          const notes = { ...d.buyerNotes };
          if (note.trim()) notes[buyerKey(buyer)] = note.trim();
          else delete notes[buyerKey(buyer)];
          return { buyerNotes: notes };
        }),
      deleteRecord: (id) => update((d) => ({ records: d.records.filter((r) => r.id !== id) })),
      saveTemplate: (template) =>
        update((d) => ({
          templates: d.templates.some((t) => t.id === template.id)
            ? d.templates.map((t) => (t.id === template.id ? template : t))
            : [...d.templates, template],
        })),
      deleteTemplate: (id) => update((d) => ({ templates: d.templates.filter((t) => t.id !== id) })),
      importCheckout: (saleId, responses) =>
        update((d) => ({
          sales: d.sales.map((s) =>
            s.id === saleId ? { ...s, checkout: { links: s.checkout?.links, responses, importedMs: Date.now() } } : s,
          ),
        })),
      linkResponse: (saleId, row, buyerKey) =>
        update((d) => ({
          sales: d.sales.map((s) => {
            if (s.id !== saleId || !s.checkout) return s;
            const links = { ...(s.checkout.links ?? {}) };
            if (buyerKey) links[row] = buyerKey;
            else delete links[row];
            return { ...s, checkout: { ...s.checkout, links } };
          }),
        })),
      setFulfillment: (saleId, key, patch) => update((d) => applyFulfillment(d, saleId, key, patch)),
    }),
    [data, update, sample, ownData],
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
