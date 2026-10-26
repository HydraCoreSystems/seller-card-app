import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { Directory, File, Paths } from 'expo-file-system';
import { cardImage, type BannerInput } from '../core/seal';
import { drawShapes, shapeFont } from './drawShapes';
import { newId } from './store';

/** Draws the card with the Commons banner on top as a new image and returns its address. */
export async function makeCardImage(text: string, banner: BannerInput): Promise<string> {
  const card = cardImage(text, banner, (s, size) => shapeFont('sans', false, size).measureText(s).width);
  const surface = Skia.Surface.Make(card.width, card.height);
  if (!surface) throw new Error('Could not make the card image');
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color(card.background));
  drawShapes(canvas, card.shapes);
  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG, 100);

  const dir = new Directory(Paths.cache, 'cards');
  if (!dir.exists) dir.create({ intermediates: true });
  const out = new File(dir, `card_${newId()}.png`);
  out.write(bytes);
  return out.uri;
}
