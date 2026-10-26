import { cardImage, type BannerInput } from '../core/seal';
import { cssFont, drawShapes } from './drawShapes.web';

export async function makeCardImage(text: string, banner: BannerInput): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const card = cardImage(text, banner, (s, size) => {
    ctx.font = cssFont('sans', false, size);
    return ctx.measureText(s).width;
  });
  canvas.width = card.width;
  canvas.height = card.height;
  ctx.fillStyle = card.background;
  ctx.fillRect(0, 0, card.width, card.height);
  drawShapes(ctx, card.shapes);
  return canvas.toDataURL('image/png');
}
