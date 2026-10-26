import { PaintStyle, Skia, matchFont, type SkCanvas, type SkFont } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import type { Shape } from '../core/seal';
import { fitSize } from '../core/stamp';

const SANS = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });
const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

export function shapeFont(font: 'serif' | 'sans', bold: boolean, size: number): SkFont {
  return matchFont({ fontFamily: font === 'serif' ? SERIF : SANS, fontSize: size, fontWeight: bold ? 'bold' : 'normal' });
}

function paint(color: string, stroke?: number) {
  const p = Skia.Paint();
  p.setColor(Skia.Color(color));
  p.setAntiAlias(true);
  if (stroke !== undefined) {
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(stroke);
  }
  return p;
}

/** Draws the seal, banner and card shapes from core/seal onto a Skia canvas. */
export function drawShapes(canvas: SkCanvas, shapes: Shape[]) {
  for (const s of shapes) {
    if (s.kind === 'circle') {
      if (s.fill) canvas.drawCircle(s.cx, s.cy, s.r, paint(s.fill));
      if (s.stroke) canvas.drawCircle(s.cx, s.cy, s.r, paint(s.stroke, s.width ?? 1));
    } else if (s.kind === 'rrect') {
      const r = Skia.RRectXY(Skia.XYWHRect(s.x, s.y, s.w, s.h), s.r, s.r);
      if (s.fill) canvas.drawRRect(r, paint(s.fill));
      if (s.stroke) canvas.drawRRect(r, paint(s.stroke, s.width ?? 1));
    } else if (s.kind === 'poly') {
      const path = Skia.PathBuilder.Make()
        .addPoly(s.points.map(([x, y]) => Skia.Point(x, y)), true)
        .detach();
      canvas.drawPath(path, paint(s.fill));
    } else if (s.kind === 'line') {
      const p = paint(s.color, s.width);
      canvas.drawLine(s.from[0], s.from[1], s.to[0], s.to[1], p);
    } else {
      const font = shapeFont(s.font, s.bold, s.size);
      if (s.maxWidth) {
        font.setSize(
          fitSize(s.size, s.maxWidth, (n) => {
            font.setSize(n);
            return font.measureText(s.text).width;
          }),
        );
      }
      const w = font.measureText(s.text).width;
      // Cap height sits near 0.7 of the size, so this puts the middle of the letters on y.
      const baseline = font.getSize() * 0.36;
      canvas.save();
      canvas.translate(s.x, s.y);
      if (s.rotate) canvas.rotate(s.rotate, 0, 0);
      canvas.drawText(s.text, s.align === 'center' ? -w / 2 : 0, baseline, paint(s.color), font);
      canvas.restore();
    }
  }
}
