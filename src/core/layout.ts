/**
 * Size classes, read from the width the app has right now. The width of the window, not the screen,
 * so the app follows Split View and the two displays of a foldable without being told which is which.
 * Regular starts at 600 points: the open inner display of a foldable is about 626 wide, a phone in
 * portrait is under 450, and half of the inner display in Split View is about 313, so it is compact.
 */
export type SizeClass = 'compact' | 'regular';

export const REGULAR_WIDTH = 600;

export const sizeClassFor = (width: number): SizeClass => (width >= REGULAR_WIDTH ? 'regular' : 'compact');

/** How many even columns fit, each at least `min` wide, never more than `max`. */
export function columnsFor(width: number, min: number, gap = 12, max = 4): number {
  const fit = Math.floor((width + gap) / (min + gap));
  return Math.max(1, Math.min(max, fit));
}

/** The widest a screen of plain content should get, so a form never stretches across a big canvas. */
export const READABLE_WIDTH = 760;

/** Splits a width in two equal panes with a gutter between. The fold of an open foldable lands in the gutter. */
export const paneWidth = (width: number, gutter = 16): number => Math.floor((width - gutter) / 2);
