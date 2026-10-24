import { ORIGIN_LINE } from './brand';
import { formatLongDate } from './text';

export interface StampText {
  main: string;
  origin: string;
}

/** "Gathering Moss · Seller #12 · October 24, 2026" over the origin line. */
export function stampText(sellerName: string, sellerNumber: string, day: string): StampText {
  const parts = [sellerName.trim()];
  if (sellerNumber.trim()) parts.push(`Seller #${sellerNumber.trim()}`);
  parts.push(formatLongDate(day));
  return { main: parts.join('  ·  '), origin: ORIGIN_LINE };
}

export interface StampLayout {
  bandTop: number;
  bandHeight: number;
  padX: number;
  mainSize: number;
  mainBaseline: number;
  originSize: number;
  originBaseline: number;
}

/**
 * A slim band along the bottom edge. Sizes follow the short side of the photo so the
 * text reads the same on tall and wide shots, and the band stays under about a tenth
 * of the frame, clear of the plant.
 */
export function stampLayout(width: number, height: number): StampLayout {
  const unit = Math.min(width, height);
  const mainSize = Math.round(unit * 0.04);
  const originSize = Math.round(unit * 0.024);
  const padY = Math.round(unit * 0.018);
  const gap = Math.round(unit * 0.01);
  const bandHeight = padY * 2 + mainSize + gap + originSize;
  const bandTop = height - bandHeight;
  return {
    bandTop,
    bandHeight,
    padX: Math.round(unit * 0.03),
    mainSize,
    mainBaseline: bandTop + padY + mainSize * 0.85,
    originSize,
    originBaseline: bandTop + padY + mainSize + gap + originSize * 0.85,
  };
}

/** Shrinks a font size until the text fits the width, given a measure function. */
export function fitSize(size: number, maxWidth: number, measure: (size: number) => number): number {
  let s = size;
  while (s > 8 && measure(s) > maxWidth) s -= 1;
  return s;
}
