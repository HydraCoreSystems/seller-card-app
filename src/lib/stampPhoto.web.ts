import { fitSize, stampLayout, stampText } from '../core/stamp';
import type { StampInput } from './stampPhoto';

export type { StampInput } from './stampPhoto';

const FONT = 'Helvetica, Arial, sans-serif';

export async function stampPhoto(input: StampInput): Promise<string> {
  const img = new Image();
  img.src = input.photoUri;
  await img.decode();
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const layout = stampLayout(w, h);
  const text = stampText(input.sellerName, input.sellerNumber, input.day);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, layout.bandTop, w, layout.bandHeight);

  const maxWidth = w - layout.padX * 2;
  const mainSize = fitSize(layout.mainSize, maxWidth, (s) => {
    ctx.font = `bold ${s}px ${FONT}`;
    return ctx.measureText(text.main).width;
  });
  ctx.font = `bold ${mainSize}px ${FONT}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text.main, layout.padX, layout.mainBaseline);

  ctx.font = `${layout.originSize}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(text.origin, layout.padX, layout.originBaseline);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function saveToGallery(uris: string[]): Promise<boolean> {
  uris.forEach((uri, i) => {
    const a = document.createElement('a');
    a.href = uri;
    a.download = `stamped_${i + 1}.jpg`;
    a.click();
  });
  return true;
}
