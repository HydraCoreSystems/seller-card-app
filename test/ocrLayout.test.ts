import { describe, expect, it } from 'vitest';
import { linesFromBoxes, type TextBox } from '../src/core/ocrLayout';

const box = (text: string, left: number, top: number, height = 20): TextBox => ({ text, left, top, width: 100, height });

describe('linesFromBoxes', () => {
  it('puts pieces in reading order whatever order the recognizer returned them', () => {
    const shuffled = [box('sold', 60, 120), box('Jada Winslow', 60, 90), box('Marcus Bell', 60, 200), box('next', 60, 230)];
    expect(linesFromBoxes(shuffled)).toEqual(['Jada Winslow', 'sold', 'Marcus Bell', 'next']);
  });
  it('joins pieces on one row left to right', () => {
    const row = [box('Reply', 200, 150), box('3m', 60, 152), box('Like', 130, 149)];
    expect(linesFromBoxes(row)).toEqual(['3m Like Reply']);
  });
  it('drops empty text and bad boxes', () => {
    expect(linesFromBoxes([box('  ', 0, 0), { text: 'x', left: NaN, top: 0, width: 1, height: 1 }, box('ok', 0, 5)])).toEqual(['ok']);
  });
});
