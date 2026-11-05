import { describe, expect, it } from 'vitest';
import { joinSlices, planTiles } from '../src/core/ocrTiles';

describe('planTiles', () => {
  it('reads a normal phone screenshot whole', () => {
    expect(planTiles(1170, 2532)).toEqual([{ y: 0, height: 2532 }]);
  });
  it('slices a long screenshot with overlap and covers every row', () => {
    const tiles = planTiles(1000, 9000);
    expect(tiles.length).toBeGreaterThan(3);
    expect(tiles[0].y).toBe(0);
    for (let i = 1; i < tiles.length; i += 1) expect(tiles[i].y).toBeLessThan(tiles[i - 1].y + tiles[i - 1].height);
    const last = tiles[tiles.length - 1];
    expect(last.y + last.height).toBe(9000);
  });
  it('handles empty sizes without slicing', () => {
    expect(planTiles(0, 0)).toEqual([{ y: 0, height: 0 }]);
  });
});

describe('joinSlices', () => {
  it('drops lines the overlap read twice', () => {
    expect(joinSlices([['a', 'b', 'c'], ['b', 'c', 'd'], ['d', 'e']])).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('keeps everything when nothing repeats and handles empty slices', () => {
    expect(joinSlices([['a'], [], ['b']])).toEqual(['a', 'b']);
  });
});
