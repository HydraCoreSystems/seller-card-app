import { stampLayout } from './stamp';

// The Commons Verified Grower seal and banner, drawn shape for shape after the reference art and
// build_seal.py kept with the Commons records. Only the Commons format ever draws these.

export const SEAL_COLORS = {
  green: '#1E4D3B',
  greenDark: '#143629',
  leaf: '#3E7C4F',
  cream: '#F7F1E3',
  gold: '#C9A227',
} as const;

export type Shape =
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; width?: number }
  | { kind: 'rrect'; x: number; y: number; w: number; h: number; r: number; fill?: string; stroke?: string; width?: number }
  | { kind: 'poly'; points: [number, number][]; fill: string }
  | { kind: 'line'; from: [number, number]; to: [number, number]; color: string; width: number }
  | {
      kind: 'text';
      text: string;
      x: number;
      y: number;
      size: number;
      font: 'serif' | 'sans';
      bold: boolean;
      color: string;
      /** center: x is the middle. left: x is the start. y is always the vertical middle of the text. */
      align: 'center' | 'left';
      /** Degrees, clockwise. */
      rotate?: number;
      /** The renderer shrinks the size until the text fits. */
      maxWidth?: number;
    };

const RING_TOP = 'THE HOYA AND ORCHID COMMONS';
const RING_BOTTOM = 'VERIFIED GROWER';
const MOTTO = 'SELL WITH YOUR WORD ON FILE';
export const BANNER_TITLE = 'COMMONS VERIFIED GROWER';
const BANNER_ROOM = 'The Hoya and Orchid Commons';

/** Letters spaced evenly along an arc. Angles in degrees, 0 at the top, clockwise. */
function ringText(text: string, cx: number, cy: number, r: number, from: number, to: number, size: number, flip: boolean): Shape[] {
  const n = text.length;
  return [...text].map((ch, i) => {
    const ang = n === 1 ? (from + to) / 2 : from + ((to - from) * i) / (n - 1);
    const rad = (ang * Math.PI) / 180;
    return {
      kind: 'text',
      text: ch,
      x: cx + r * Math.sin(rad),
      y: cy - r * Math.cos(rad),
      size,
      font: 'sans',
      bold: true,
      color: SEAL_COLORS.cream,
      align: 'center',
      rotate: flip ? ang - 180 : ang,
    } satisfies Shape;
  });
}

/** The leaf mark: two soft arcs, a midrib and three pairs of veins, tilted up to the right. */
function leaf(cx: number, cy: number, length: number, width: number, tilt: number, k: number): Shape[] {
  const a = (tilt * Math.PI) / 180;
  // Turned counterclockwise on screen, so the tip points up and right.
  const at = (x: number, y: number): [number, number] => [cx + x * Math.cos(a) + y * Math.sin(a), cy - x * Math.sin(a) + y * Math.cos(a)];
  const half = (t: number) => width * Math.sin(Math.PI * t) ** 0.8;
  const top: [number, number][] = [];
  const bottom: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const x = -length / 2 + length * t;
    top.push(at(x, -half(t)));
    bottom.push(at(x, half(t)));
  }
  const shapes: Shape[] = [
    { kind: 'poly', points: [...top, ...bottom.reverse()], fill: SEAL_COLORS.leaf },
    { kind: 'line', from: at(-length / 2, 0), to: at(length / 2, 0), color: SEAL_COLORS.greenDark, width: 6 * k },
  ];
  for (const f of [0.25, 0.45, 0.65]) {
    const x = -length / 2 + length * f;
    const w = half(f) * 0.82;
    shapes.push({ kind: 'line', from: at(x, 0), to: at(x + length * 0.1, -w), color: SEAL_COLORS.greenDark, width: 4 * k });
    shapes.push({ kind: 'line', from: at(x, 0), to: at(x + length * 0.1, w), color: SEAL_COLORS.greenDark, width: 4 * k });
  }
  return shapes;
}

/** The circular seal, centered at (cx, cy), for a grower number as the seller typed it. */
export function sealShapes(number: string, cx: number, cy: number, diameter: number): Shape[] {
  // The reference art is drawn on a 2000 square; k turns its units into ours.
  const k = diameter / 2000;
  const u = (n: number) => n * k;
  return [
    { kind: 'circle', cx, cy, r: u(960), fill: SEAL_COLORS.green },
    { kind: 'circle', cx, cy, r: u(801), stroke: SEAL_COLORS.gold, width: u(10) },
    { kind: 'circle', cx, cy, r: u(780), fill: SEAL_COLORS.cream },
    { kind: 'circle', cx, cy, r: u(777), stroke: SEAL_COLORS.greenDark, width: u(6) },
    ...ringText(RING_TOP, cx, cy, u(884), -104, 104, u(118), false),
    ...ringText(RING_BOTTOM, cx, cy, u(884), 232, 128, u(118), true),
    { kind: 'circle', cx: cx - u(700), cy, r: u(26), fill: SEAL_COLORS.gold },
    { kind: 'circle', cx: cx + u(700), cy, r: u(26), fill: SEAL_COLORS.gold },
    ...leaf(cx, cy - u(210), u(760), u(210), 38, k),
    { kind: 'text', text: `No. ${number.trim()}`, x: cx, y: cy + u(190), size: u(300), font: 'serif', bold: true, color: SEAL_COLORS.greenDark, align: 'center', maxWidth: u(1300) },
    { kind: 'text', text: MOTTO, x: cx, y: cy + u(392), size: u(66), font: 'sans', bold: true, color: SEAL_COLORS.green, align: 'center' },
  ];
}

export interface BannerInput {
  number: string;
  name: string;
  /** The vetted business name, as the desk wrote it. Blank when there's none. */
  business: string;
}

/** The banner's height for a given width. The reference banner is 2400 by 760. */
export const bannerHeight = (width: number) => Math.round((width * 760) / 2400);

/** The wide banner for the card image: the seal on the left, the grower's lines on the right. */
export function bannerShapes(b: BannerInput, x: number, y: number, width: number): Shape[] {
  const k = width / 2400;
  const u = (n: number) => n * k;
  const left = x + u(780);
  const maxWidth = u(2400 - 780 - 70);
  const line = (text: string, at: number, size: number, bold: boolean, color: string, font: 'serif' | 'sans' = 'sans'): Shape => ({
    kind: 'text', text, x: left, y: y + u(at), size: u(size), font, bold, color, align: 'left', maxWidth,
  });
  const business = b.business.trim();
  return [
    { kind: 'rrect', x: x + u(4), y: y + u(4), w: u(2392), h: u(752), r: u(90), fill: SEAL_COLORS.green },
    { kind: 'rrect', x: x + u(30), y: y + u(30), w: u(2340), h: u(700), r: u(72), stroke: SEAL_COLORS.gold, width: u(8) },
    ...sealShapes(b.number, x + u(56 + 320), y + u(60 + 320), u(640)),
    line(BANNER_TITLE, 168, 118, true, SEAL_COLORS.cream, 'serif'),
    line(`No. ${b.number.trim()} · ${b.name.trim()}`, 322, 92, false, SEAL_COLORS.cream),
    ...(business
      ? [line(business, 452, 84, false, SEAL_COLORS.cream), line(BANNER_ROOM, 592, 80, true, SEAL_COLORS.gold)]
      : [line(BANNER_ROOM, 472, 80, true, SEAL_COLORS.gold)]),
  ];
}

export interface SealPlace {
  cx: number;
  cy: number;
  diameter: number;
}

/**
 * Where the seal sits on a listing photo: the lower right corner, about a fifth of the photo
 * wide so the number reads on a phone, resting just above the stamp band.
 */
export function sealPlace(width: number, height: number): SealPlace {
  const unit = Math.min(width, height);
  const diameter = Math.round(width * 0.2);
  const margin = Math.round(unit * 0.03);
  const { bandTop } = stampLayout(width, height);
  return { cx: width - margin - diameter / 2, cy: bandTop - margin - diameter / 2, diameter };
}

export interface CardImage {
  width: number;
  height: number;
  background: string;
  shapes: Shape[];
}

/** Splits text into lines that fit, word by word. A word too long for a line gets a line of its own. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next) > maxWidth) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

/**
 * The card as an image: the banner across the top, then the card's own text, which keeps the
 * grower number line so the card reads true even when the banner is cropped away.
 * measure gives a line's width at the given text size.
 */
export function cardImage(text: string, banner: BannerInput, measure: (s: string, size: number) => number): CardImage {
  const width = 1080;
  const pad = 56;
  const size = 34;
  const lineHeight = Math.round(size * 1.45);
  const top = pad + bannerHeight(width - pad * 2) + pad;
  const lines = wrapText(text.trim(), width - pad * 2, (s) => measure(s, size));
  const shapes: Shape[] = bannerShapes(banner, pad, pad, width - pad * 2);
  lines.forEach((l, i) => {
    if (l) shapes.push({ kind: 'text', text: l, x: pad, y: top + lineHeight * i + lineHeight / 2, size, font: 'sans', bold: false, color: SEAL_COLORS.greenDark, align: 'left' });
  });
  return { width, height: top + lineHeight * lines.length + pad, background: SEAL_COLORS.cream, shapes };
}
