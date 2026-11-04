import type { Fulfillment, Sale, SaleRecord } from './types';
import { buyerKey } from './buyers';

/**
 * Resume. The app remembers the sale the seller has open and the screen they were on, so getting knocked
 * out of the app in the middle of a sale (closed, killed by the system, crashed) puts them straight back.
 * It lives in the same phone storage as the profile and is rewritten as the seller moves through the sale.
 */

/** A lot form the seller was filling in, kept so a crash does not eat half a listing. */
export interface LotDraft {
  /** The lot being changed, or null for a new lot. */
  n: string | null;
  name: string;
  noid: boolean;
  priceText: string;
  description: string;
  photoUris: string[];
}

export interface Resume {
  version: 1;
  saleId: string;
  /** Where the seller was, as an app path like /sale/abc/claims. */
  path: string;
  at: number;
  lotDraft?: LotDraft | null;
}

export const RESUME_COPY = {
  title: 'Resume your sale',
  where: (screen: string) => `You were on ${screen}. One tap puts you back.`,
};

const SCREENS: Record<string, string> = {
  '': 'the showcase',
  post: 'posting',
  lot: 'a lot',
  claims: 'claims',
  rundown: 'the rundown',
  checkout: 'buyer checkout',
  packing: 'packing',
  money: 'what you kept',
};

/** The sale and the screen a path names, or null when it is not a screen inside a sale. */
export function trackPath(pathname: string, params: Record<string, string | string[] | undefined> = {}): { saleId: string; path: string } | null {
  const m = pathname.match(/^\/sale\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!m || m[1] === 'new') return null;
  const screen = m[2] ?? '';
  if (!(screen in SCREENS)) return null;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const query: string[] = [];
  // A lot being posted or changed keeps its number, so the seller lands on the same card.
  for (const k of ['lot', 'n']) {
    const v = first(params[k]);
    if (v && /^\d+$/.test(v)) query.push(`${k}=${v}`);
  }
  return { saleId: m[1], path: `/sale/${m[1]}${screen ? `/${screen}` : ''}${query.length ? `?${query.join('&')}` : ''}` };
}

/** What the seller was doing, in words. */
export function screenName(path: string): string {
  const screen = path.match(/^\/sale\/[^/?]+(?:\/([^/?]+))?/)?.[1] ?? '';
  return SCREENS[screen] ?? SCREENS[''];
}

/** The resume state after the seller moves to a screen. A different sale starts clean. */
export function moveTo(prev: Resume | null, tracked: { saleId: string; path: string }, now: number): Resume {
  const same = prev && prev.saleId === tracked.saleId;
  return { version: 1, saleId: tracked.saleId, path: tracked.path, at: now, lotDraft: same ? prev.lotDraft ?? null : null };
}

/** Reads saved state, ignoring anything that is not the shape written. */
export function readResume(raw: unknown): Resume | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Resume>;
  if (r.version !== 1 || typeof r.saleId !== 'string' || typeof r.path !== 'string' || !r.path.startsWith('/sale/')) return null;
  const d = r.lotDraft;
  const draft: LotDraft | null =
    d && typeof d === 'object' && typeof d.name === 'string' && typeof d.priceText === 'string' && typeof d.description === 'string' && Array.isArray(d.photoUris)
      ? { n: typeof d.n === 'string' ? d.n : null, name: d.name, noid: !!d.noid, priceText: d.priceText, description: d.description, photoUris: d.photoUris.filter((u): u is string => typeof u === 'string') }
      : null;
  return { version: 1, saleId: r.saleId, path: r.path, at: typeof r.at === 'number' ? r.at : 0, lotDraft: draft };
}

/** Every buyer who has a lot in this sale and has not been marked never paid shipped, counting at least one buyer. */
export function fullyShipped(sale: Sale, records: SaleRecord[]): boolean {
  const buyers = new Set(records.filter((r) => r.saleId === sale.id && r.payment !== 'never').map((r) => buyerKey(r.buyer)));
  if (!buyers.size) return false;
  const f: Record<string, Fulfillment> = sale.fulfillment ?? {};
  return [...buyers].every((b) => !!f[b]?.shipped);
}

/**
 * The sale to resume, or null. A sale stops being the target only when the seller has closed it out or it is
 * fully shipped, or when it is gone. Starting a different sale moves the target (moveTo), so there is one.
 */
export function resumeTarget(resume: Resume | null, sales: Sale[], records: SaleRecord[]): { sale: Sale; path: string } | null {
  if (!resume) return null;
  const sale = sales.find((s) => s.id === resume.saleId);
  if (!sale || sale.closedAt || fullyShipped(sale, records)) return null;
  return { sale, path: resume.path };
}

/** A lot draft that belongs to this lot form, or null. */
export function draftFor(resume: Resume | null, saleId: string, n: string | null | undefined): LotDraft | null {
  const d = resume?.saleId === saleId ? resume.lotDraft : null;
  return d && d.n === (n ?? null) ? d : null;
}

/** What the Home entry calls the sale: the seller's own name for it, or the showcase and its lot count. */
export function resumeName(sale: Sale): string {
  const named = sale.name?.trim();
  if (named) return named;
  const n = sale.lots.length;
  return `${sale.kind === 'auction' ? 'Grower Showcase auction' : 'Grower Showcase'}, ${n} ${n === 1 ? 'lot' : 'lots'}`;
}
