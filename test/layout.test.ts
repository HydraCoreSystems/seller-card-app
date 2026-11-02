import { describe, expect, it } from 'vitest';
import { READABLE_WIDTH, REGULAR_WIDTH, columnsFor, paneWidth, sizeClassFor } from '../src/core/layout';

describe('size classes', () => {
  it('reads the width the app has: a phone, the outer and inner displays of a foldable, and half of the inner display', () => {
    expect(sizeClassFor(390)).toBe('compact');
    expect(sizeClassFor(466)).toBe('compact'); // outer display, 1398 px at 3x
    expect(sizeClassFor(626)).toBe('regular'); // inner display, 1878 px at 3x
    expect(sizeClassFor(313)).toBe('compact'); // Split View on the inner display is a fixed half
    expect(sizeClassFor(REGULAR_WIDTH)).toBe('regular');
    expect(sizeClassFor(REGULAR_WIDTH - 1)).toBe('compact');
  });

  it('fits even columns, at least one and never more than the cap', () => {
    expect(columnsFor(300, 250)).toBe(1);
    expect(columnsFor(594, 270)).toBe(2);
    expect(columnsFor(1000, 250)).toBe(3);
    expect(columnsFor(2000, 100, 12, 4)).toBe(4);
    expect(columnsFor(50, 250)).toBe(1);
  });

  it('splits the open inner display into two equal panes with the gutter at the middle', () => {
    expect(paneWidth(626) * 2 + 16).toBeLessThanOrEqual(626);
    expect(paneWidth(626, 0)).toBe(313);
    expect(READABLE_WIDTH).toBeGreaterThan(REGULAR_WIDTH);
  });
});
