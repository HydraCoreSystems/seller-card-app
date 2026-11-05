/**
 * Settings: what the seller can change about how new cards and photos come out. Every default here
 * is the app's behavior from before Settings existed, so a seller who never opens Settings sees no change.
 * Stored on the phone under its own key, beside the profile.
 */
import type { SaleKind } from './types';

export type StampPosition = 'bottom' | 'top';
export type StampStrength = 'light' | 'medium' | 'strong';

/** The watermark on a stamped photo: the band with the seller's line, and the room's circle. */
export interface StampStyle {
  on: boolean;
  /** Replaces the band's first line when not blank. Blank keeps the automatic line. */
  text: string;
  position: StampPosition;
  strength: StampStrength;
}

/** What a new card starts with. */
export interface CardDefaults {
  /** auto keeps today's behavior: an auction when most of the seller's plants are auctions, else a sale. */
  kind: 'auto' | SaleKind;
  /** The note a new card starts with. Blank prints none. */
  note: string;
  /** Where else the plants are listed, filled in for each new card. */
  crossListing: string;
}

export interface Settings {
  version: 1;
  stamp: StampStyle;
  card: CardDefaults;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  stamp: { on: true, text: '', position: 'bottom', strength: 'medium' },
  card: { kind: 'auto', note: '', crossListing: '' },
};

/** How dark the band under the stamp text is. Medium is the band as it has always been. */
export const BAND_ALPHA: Record<StampStrength, number> = { light: 0.3, medium: 0.55, strong: 0.8 };

export const STAMP_TEXT_LIMIT = 80;

const POSITIONS: StampPosition[] = ['bottom', 'top'];
const STRENGTHS: StampStrength[] = ['light', 'medium', 'strong'];

/** Reads saved settings. Anything missing or unreadable falls back to the default for that field. */
export function readSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { stamp?: Partial<StampStyle>; card?: Partial<CardDefaults> };
  const s = r.stamp ?? {};
  const c = r.card ?? {};
  const d = DEFAULT_SETTINGS;
  return {
    version: 1,
    stamp: {
      on: typeof s.on === 'boolean' ? s.on : d.stamp.on,
      text: typeof s.text === 'string' ? s.text.slice(0, STAMP_TEXT_LIMIT) : d.stamp.text,
      position: POSITIONS.includes(s.position as StampPosition) ? (s.position as StampPosition) : d.stamp.position,
      strength: STRENGTHS.includes(s.strength as StampStrength) ? (s.strength as StampStrength) : d.stamp.strength,
    },
    card: {
      kind: c.kind === 'sale' || c.kind === 'auction' || c.kind === 'auto' ? c.kind : d.card.kind,
      note: typeof c.note === 'string' ? c.note : d.card.note,
      crossListing: typeof c.crossListing === 'string' ? c.crossListing : d.card.crossListing,
    },
  };
}

/** The kind a new card starts as. */
export function startingKind(card: CardDefaults, mostlyAuction: boolean): SaleKind {
  return card.kind === 'auto' ? (mostlyAuction ? 'auction' : 'sale') : card.kind;
}

/** A stable text for a style, so a stamped copy is remade when any part of the style changes. */
export const stampKey = (s: StampStyle): string => `${s.on ? 1 : 0}|${s.position}|${s.strength}|${s.text.trim()}`;
