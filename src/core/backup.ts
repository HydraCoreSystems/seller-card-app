/**
 * The backup of a seller's Skrybix data, kept in a Skrybix folder in the seller's own Google Drive.
 * Everything here is plain logic with no network and no phone in it, so it is tested without either.
 *
 * Layout, version 1: one JSON file, skrybix-backup.json, plus the plant photos beside it as their own
 * files. The JSON says which photos it needs, by file name, so a phone that has lost its photos can fetch
 * exactly those. Fields:
 *
 *   app        always "skrybix"
 *   version    the layout version, 1. A reader that sees a higher number stops and asks for an update.
 *   revision   whole number, up one on every write. A writer checks it before writing so two devices
 *              (the phone, and later the computer) never silently overwrite each other.
 *   savedAt    ISO time of the write
 *   savedBy    "phone" or "computer"
 *   photos     file names of the photos the data uses (names only, unless BACKUP_PHOTO_FILES is on)
 *   meta       { pro }: whether the phone had Pro when it wrote, for the computer version
 *   data       profile, plants, sales, records, buyerNotes, leftoversDone, templates
 *
 * Photo addresses inside data are stored as "skrybix-photo:NAME" so they mean the same on any device,
 * and turned back into the phone's own addresses when the data is restored.
 */
import type { Plant, Profile, Sale, SaleRecord, SaleTemplate } from './types';

export const BACKUP_VERSION = 1;
export const BACKUP_FOLDER = 'Skrybix';
export const BACKUP_FILE = 'skrybix-backup.json';
export const PHOTO_PREFIX = 'skrybix-photo:';

/** Everything a seller would lose if the phone died tonight. */
export interface BackupData {
  profile: Profile | null;
  plants: Plant[];
  sales: Sale[];
  records: SaleRecord[];
  buyerNotes: Record<string, string>;
  leftoversDone: string[];
  templates: SaleTemplate[];
}

export interface Backup {
  app: 'skrybix';
  version: number;
  revision: number;
  savedAt: string;
  savedBy: 'phone' | 'computer';
  photos: string[];
  /** Said by the phone for the computer version, which has no way to ask Apple. */
  meta: { pro: boolean };
  data: BackupData;
}

/**
 * Photos stay on the phone: the backup holds their names only, not the files. Flip this to also
 * upload the files beside the backup, so a new phone gets its photos back too.
 */
export const BACKUP_PHOTO_FILES = false;

const PHOTO_PATH = /(?:^|\/)photos\/([^/?#]+\.(?:jpe?g|png|webp|heic))$/i;

/** The file name of one of the app's own photos, or null for anything else. */
export function photoName(uri: string): string | null {
  const m = uri.match(PHOTO_PATH);
  return m && (uri.startsWith('file:') || uri.startsWith('/')) ? decodeURIComponent(m[1]) : null;
}

/** Copies a value, changing every string for the one `change` gives back. */
function mapStrings<T>(value: T, change: (s: string) => string): T {
  if (typeof value === 'string') return change(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, change)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, change);
    return out as T;
  }
  return value;
}

export const EMPTY_BACKUP_DATA: BackupData = {
  profile: null,
  plants: [],
  sales: [],
  records: [],
  buyerNotes: {},
  leftoversDone: [],
  templates: [],
};

/** Builds the file to write, and says which photos it needs beside it. */
export function packBackup(
  data: BackupData,
  opts: { revision: number; now: number; savedBy?: 'phone' | 'computer'; pro?: boolean },
): Backup {
  const names = new Set<string>();
  const portable = mapStrings(data, (s) => {
    const name = photoName(s);
    if (!name) return s;
    names.add(name);
    return PHOTO_PREFIX + name;
  });
  return {
    app: 'skrybix',
    version: BACKUP_VERSION,
    revision: opts.revision,
    savedAt: new Date(opts.now).toISOString(),
    savedBy: opts.savedBy ?? 'phone',
    photos: [...names].sort(),
    meta: { pro: !!opts.pro },
    data: portable,
  };
}

/** Turns the portable photo names back into this phone's own addresses. `dir` is the photos folder, no trailing slash. */
export function unpackData(backup: Backup, dir: string): BackupData {
  return mapStrings(backup.data, (s) => (s.startsWith(PHOTO_PREFIX) ? `${dir}/${s.slice(PHOTO_PREFIX.length)}` : s));
}

export type Parsed = { ok: true; backup: Backup } | { ok: false; error: string };

/** Reads a backup file, refusing anything that is not one, or that a newer Skrybix wrote. */
export function parseBackup(text: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The backup file could not be read.' };
  }
  const b = raw as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.app !== 'skrybix' || typeof b.version !== 'number') {
    return { ok: false, error: 'That file is not a Skrybix backup.' };
  }
  if (b.version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup was made by a newer Skrybix. Update the app, then try again.' };
  }
  const d: Partial<BackupData> = b.data && typeof b.data === 'object' ? b.data : {};
  return {
    ok: true,
    backup: {
      app: 'skrybix',
      version: b.version,
      revision: Number.isFinite(b.revision) ? (b.revision as number) : 0,
      savedAt: typeof b.savedAt === 'string' ? b.savedAt : '',
      savedBy: b.savedBy === 'computer' ? 'computer' : 'phone',
      meta: { pro: (b as { meta?: { pro?: unknown } }).meta?.pro === true },
      photos: Array.isArray(b.photos) ? b.photos.filter((p): p is string => typeof p === 'string') : [],
      data: {
        profile: d.profile ?? null,
        plants: Array.isArray(d.plants) ? d.plants : [],
        sales: Array.isArray(d.sales) ? d.sales : [],
        records: Array.isArray(d.records) ? d.records : [],
        buyerNotes: d.buyerNotes && typeof d.buyerNotes === 'object' ? d.buyerNotes : {},
        leftoversDone: Array.isArray(d.leftoversDone) ? d.leftoversDone : [],
        templates: Array.isArray(d.templates) ? d.templates : [],
      },
    },
  };
}

/** True when there is anything in the data worth protecting from a restore. */
export function hasData(d: BackupData): boolean {
  return !!d.profile || d.plants.length > 0 || d.sales.length > 0 || d.records.length > 0;
}

/** "12 plants, 3 showcases, 9 sales" for the restore question. */
export function summary(b: Backup): string {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  return [n(b.data.plants.length, 'plant', 'plants'), n(b.data.sales.length, 'showcase', 'showcases'), n(b.data.records.length, 'sale record', 'sale records')].join(', ');
}

/** The part of the backup that shows a change: the data, without the revision or the time. */
export function fingerprint(d: BackupData): string {
  return JSON.stringify(d);
}

/** A short stamp of the data, small enough to keep on the phone, so a backup is skipped when nothing changed since the last one. */
export function digest(d: BackupData): string {
  const text = fingerprint(d);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${text.length}:${h.toString(36)}`;
}

/** What the scheduler needs to know to decide whether to back up now. */
export interface BackupClock {
  connected: boolean;
  allowed: boolean;
  /** Something changed since the last backup. */
  dirty: boolean;
  lastAt: number | null;
  now: number;
  /** A sale just closed, so back up without waiting out the gap. */
  closedNow: boolean;
  /** A write is already running, or another device changed the backup and the seller has not chosen yet. */
  blocked: boolean;
}

/** The regular schedule while the app is open: at most one backup every ten minutes. */
export const BACKUP_GAP_MS = 10 * 60_000;

export function shouldBackUp(c: BackupClock): boolean {
  if (!c.connected || !c.allowed || !c.dirty || c.blocked) return false;
  if (c.closedNow) return true;
  return c.lastAt === null || c.now - c.lastAt >= BACKUP_GAP_MS;
}

/**
 * Takes out every reference to a photo file the phone does not have, so nothing points at a photo
 * that is not there. `dir` is the photos folder, no trailing slash. Returns how many photos were left out.
 */
export function dropMissingPhotos(data: BackupData, dir: string, missing: Set<string>): { data: BackupData; dropped: number } {
  const gone = new Set([...missing].map((n) => `${dir}/${n}`));
  let dropped = 0;
  const walk = <T,>(value: T): T => {
    if (Array.isArray(value)) return value.filter((v) => !(typeof v === 'string' && gone.has(v))).map(walk) as unknown as T;
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) out[k] = typeof v === 'string' && gone.has(v) ? null : walk(v);
      return out as T;
    }
    return value;
  };
  for (const n of missing) if (n) dropped += 1;
  return { data: walk(data), dropped };
}
