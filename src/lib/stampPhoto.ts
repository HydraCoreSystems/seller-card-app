import { ImageFormat, Skia, matchFont } from '@shopify/react-native-skia';
import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';
import { fitSize, stampLayout, stampText } from '../core/stamp';
import { newId } from './store';

export interface StampInput {
  photoUri: string;
  sellerName: string;
  sellerNumber: string;
  day: string;
}

const family = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });

/** Draws the stamp onto a new copy of the photo and returns that copy's address. */
export async function stampPhoto(input: StampInput): Promise<string> {
  const data = await Skia.Data.fromURI(input.photoUri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Could not read the photo');
  const w = image.width();
  const h = image.height();
  const surface = Skia.Surface.Make(w, h);
  if (!surface) throw new Error('Could not make the stamped copy');
  const canvas = surface.getCanvas();
  canvas.drawImage(image, 0, 0);

  const layout = stampLayout(w, h);
  const text = stampText(input.sellerName, input.sellerNumber, input.day);

  const band = Skia.Paint();
  band.setColor(Skia.Color('rgba(0,0,0,0.55)'));
  canvas.drawRect(Skia.XYWHRect(0, layout.bandTop, w, layout.bandHeight), band);

  const white = Skia.Paint();
  white.setColor(Skia.Color('#FFFFFF'));
  white.setAntiAlias(true);
  const maxWidth = w - layout.padX * 2;

  const mainFont = matchFont({ fontFamily: family, fontSize: layout.mainSize, fontWeight: 'bold' });
  mainFont.setSize(
    fitSize(layout.mainSize, maxWidth, (s) => {
      mainFont.setSize(s);
      return mainFont.measureText(text.main).width;
    }),
  );
  canvas.drawText(text.main, layout.padX, layout.mainBaseline, white, mainFont);

  const soft = Skia.Paint();
  soft.setColor(Skia.Color('rgba(255,255,255,0.85)'));
  soft.setAntiAlias(true);
  const originFont = matchFont({ fontFamily: family, fontSize: layout.originSize, fontWeight: 'normal' });
  canvas.drawText(text.origin, layout.padX, layout.originBaseline, soft, originFont);

  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 92);

  const dir = new Directory(Paths.cache, 'stamped');
  if (!dir.exists) dir.create({ intermediates: true });
  const out = new File(dir, `stamped_${newId()}.jpg`);
  out.write(bytes);
  return out.uri;
}

/** Saves stamped copies to the phone's photo gallery, ready to attach to a post. */
export async function saveToGallery(uris: string[]): Promise<boolean> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) return false;
  for (const uri of uris) await MediaLibrary.saveToLibraryAsync(uri);
  return true;
}
