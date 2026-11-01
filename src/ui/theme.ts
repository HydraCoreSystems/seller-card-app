import type { Variant } from '../core/variant';
import { variant } from '../core/variant';

/**
 * The look of each build. The closed test theme is the app exactly as it shipped before the sweep, value
 * for value, and test/theme.test.tsx locks it. The Phil theme is the layered look: a recessed background,
 * raised white cards, inset fields, and floating bars and buttons.
 */
export type Palette = {
  bg: string;
  card: string;
  ink: string;
  soft: string;
  line: string;
  moss: string;
  mossDark: string;
  mossTint: string;
  warn: string;
  warnTint: string;
  danger: string;
};

export type Theme = {
  name: Variant;
  colors: Palette;
  /** Font family for headings and the wordmark. Undefined means the system font. */
  display: string | undefined;
};

export const CLOSED_COLORS: Palette = {
  bg: '#F6F4EE',
  card: '#FFFFFF',
  ink: '#1F2A1F',
  soft: '#5E6B5E',
  line: '#DCD8CC',
  moss: '#3E6B3A',
  mossDark: '#2C4F29',
  mossTint: '#E4EEDF',
  warn: '#9A5B00',
  warnTint: '#FFF1D6',
  danger: '#A33A2B',
};

/** The Phil palette: the same names, with the background a shade deeper so cards read as raised off it. */
export const PHIL_COLORS: Palette = {
  ...CLOSED_COLORS,
  bg: '#F0EBDD',
  line: '#DDD6C4',
};

/**
 * Colors only the Phil theme uses. Gold is the single accent: rules, ticks, price pills and the deadline chip.
 * It is always paired with dark text and never used as body text on white.
 */
export const ACCENT = {
  deep: '#1E4D3B',
  deepDark: '#143629',
  gold: '#C9A227',
  goldInk: '#1F2A1F',
  /** Text and outlines on the deep green bars. */
  cream: '#F6F1E2',
  creamSoft: '#D8D2BC',
  /** Fields sit pressed in: a fill one shade under card white, with a darker inner top edge. */
  inset: '#F9F7F0',
  insetEdge: '#E2DCCB',
  insetTop: '#CBC3AB',
  shadow: '#1F2A1F',
};

/** What each rundown status chip looks like. Paid and shipped carry white text on a solid fill. */
export const STAGE_LOOK = {
  won: { backgroundColor: '#E4EEDF', color: '#1F2A1F' },
  contacted: { backgroundColor: '#FFF1D6', color: '#1F2A1F' },
  paid: { backgroundColor: '#3E6B3A', color: '#FFFFFF' },
  shipped: { backgroundColor: '#1E4D3B', color: '#FFFFFF' },
} as const;

export const DISPLAY_FONT = 'Fraunces_600SemiBold';

const CLOSED_THEME: Theme = { name: 'closedTest', colors: CLOSED_COLORS, display: undefined };
const PHIL_THEME: Theme = { name: 'phil', colors: PHIL_COLORS, display: DISPLAY_FONT };

export const themeFor = (v: Variant): Theme => (v === 'phil' ? PHIL_THEME : CLOSED_THEME);

/** The theme this build wears. Read when asked, like the variant, so tests can switch it. */
export const theme = (): Theme => themeFor(variant());

/** Blends two #RRGGBB colors. t = 0 gives a, t = 1 gives b. Used to draw the header band gradient. */
export function mixHex(a: string, b: string, t: number): string {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = (i: number) => Math.round(n(a, i) + (n(b, i) - n(a, i)) * t).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`.toUpperCase();
}
