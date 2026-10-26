import type { Shape } from '../core/seal';
import { fitSize } from '../core/stamp';

const FAMILY = { sans: 'Helvetica, Arial, sans-serif', serif: '"Times New Roman", Times, serif' };

export const cssFont = (font: 'serif' | 'sans', bold: boolean, size: number) => `${bold ? 'bold ' : ''}${size}px ${FAMILY[font]}`;

/** Draws the seal, banner and card shapes from core/seal onto a browser canvas. */
export function drawShapes(ctx: CanvasRenderingContext2D, shapes: Shape[]) {
  for (const s of shapes) {
    if (s.kind === 'circle' || s.kind === 'rrect') {
      ctx.beginPath();
      if (s.kind === 'circle') ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
      else ctx.roundRect(s.x, s.y, s.w, s.h, s.r);
      if (s.fill) {
        ctx.fillStyle = s.fill;
        ctx.fill();
      }
      if (s.stroke) {
        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = s.width ?? 1;
        ctx.stroke();
      }
    } else if (s.kind === 'poly') {
      ctx.beginPath();
      s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = s.fill;
      ctx.fill();
    } else if (s.kind === 'line') {
      ctx.beginPath();
      ctx.moveTo(...s.from);
      ctx.lineTo(...s.to);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.stroke();
    } else {
      const size = s.maxWidth
        ? fitSize(s.size, s.maxWidth, (n) => {
            ctx.font = cssFont(s.font, s.bold, n);
            return ctx.measureText(s.text).width;
          })
        : s.size;
      ctx.font = cssFont(s.font, s.bold, size);
      ctx.fillStyle = s.color;
      ctx.textAlign = s.align;
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.translate(s.x, s.y);
      if (s.rotate) ctx.rotate((s.rotate * Math.PI) / 180);
      ctx.fillText(s.text, 0, 0);
      ctx.restore();
    }
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
