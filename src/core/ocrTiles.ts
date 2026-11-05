/** Long screenshots read badly in one piece, so they are read in overlapping slices and joined back up. */

export interface Tile {
  y: number;
  height: number;
}

/** A screenshot taller than this many widths is read in slices. A normal phone screen is about 2.2. */
export const TALL_RATIO = 2.8;
const SLICE_RATIO = 1.8;
const OVERLAP = 0.1;

export function planTiles(width: number, height: number): Tile[] {
  if (width <= 0 || height <= 0 || height <= width * TALL_RATIO) return [{ y: 0, height: Math.max(height, 0) }];
  const slice = Math.round(width * SLICE_RATIO);
  const step = Math.round(slice * (1 - OVERLAP));
  const out: Tile[] = [];
  for (let y = 0; y < height; y += step) {
    const h = Math.min(slice, height - y);
    // A sliver at the very end was already inside the slice before it.
    if (out.length && h < slice * OVERLAP * 2) break;
    out.push({ y, height: h });
    if (y + h >= height) break;
  }
  return out;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Joins the lines read from overlapping slices, dropping the lines the overlap read twice. */
export function joinSlices(slices: string[][]): string[] {
  const out: string[] = [];
  for (const slice of slices) {
    let drop = 0;
    const max = Math.min(out.length, slice.length);
    for (let n = max; n > 0; n -= 1) {
      const tail = out.slice(out.length - n);
      if (tail.every((l, i) => same(l, slice[i]))) {
        drop = n;
        break;
      }
    }
    out.push(...slice.slice(drop));
  }
  return out;
}
