/**
 * Where the recognizer saw each piece of text. Native code hands back the pieces with their boxes, and this
 * puts them in reading order by position, so the order of claims never depends on the recognizer's own order.
 */

export interface TextBox {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Top to bottom, and left to right within one visual row. Pieces on the same row join into one line. */
export function linesFromBoxes(boxes: TextBox[]): string[] {
  const usable = boxes.filter((b) => b.text.trim() && Number.isFinite(b.top) && Number.isFinite(b.left));
  const sorted = [...usable].sort((a, b) => a.top - b.top || a.left - b.left);
  const rows: TextBox[][] = [];
  for (const b of sorted) {
    const row = rows[rows.length - 1];
    const first = row?.[0];
    // Same row when this piece starts before the row's first piece is half done.
    if (row && first && b.top < first.top + first.height * 0.5) row.push(b);
    else rows.push([b]);
  }
  return rows.map((r) => [...r].sort((a, b) => a.left - b.left).map((b) => b.text.trim()).join(' '));
}
