import { extractTextFromImage, isSupported } from 'expo-text-extractor';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { joinSlices, planTiles } from '../core/ocrTiles';

/** True when this device can read text out of a picture. It all happens on the device. */
export const ocrAvailable: boolean = isSupported;

export interface ScreenRead {
  /** What was read from each screenshot, in the order the seller picked them. */
  screens: string[][];
  /** How many screenshots the device could not read. Their place stays, empty, so the order holds. */
  failed: number;
}

const hasText = (lines: string[]) => lines.some((l) => l.trim().length > 0);

/**
 * Reads one screenshot. The picture is first saved again as a plain JPEG, which settles HEIC, odd color
 * profiles and rotation, and a very tall one is read in slices. If that reads nothing, the original goes in
 * as it came, so a problem with the saved copy cannot cost a screenshot that would have read fine.
 */
async function readOne(asset: ImagePicker.ImagePickerAsset): Promise<string[]> {
  try {
    const image = await ImageManipulator.manipulate(asset.uri).renderAsync();
    const saved = await image.saveAsync({ compress: 1, format: SaveFormat.JPEG });
    const tiles = planTiles(saved.width, saved.height);
    const parts: string[][] = [];
    for (const t of tiles) {
      if (tiles.length === 1) {
        parts.push(await extractTextFromImage(saved.uri));
        continue;
      }
      const piece = await ImageManipulator.manipulate(saved.uri)
        .crop({ originX: 0, originY: t.y, width: saved.width, height: t.height })
        .renderAsync();
      const file = await piece.saveAsync({ compress: 1, format: SaveFormat.JPEG });
      parts.push(await extractTextFromImage(file.uri));
    }
    const lines = joinSlices(parts);
    if (hasText(lines)) return lines;
  } catch {
    // Fall through to the picture as it came.
  }
  return extractTextFromImage(asset.uri);
}

/** Lets the seller pick screenshots, in order, and reads each one on the device. Null when they back out. */
export async function readScreenshots(): Promise<ScreenRead | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    // iPhone returns them in the order tapped. Without this the order would not be promised.
    orderedSelection: true,
    selectionLimit: 12,
    quality: 1,
  });
  if (result.canceled || !result.assets?.length) return null;
  const screens: string[][] = [];
  let failed = 0;
  for (const asset of result.assets) {
    try {
      screens.push(await readOne(asset));
    } catch {
      screens.push([]);
      failed += 1;
    }
  }
  return { screens, failed };
}
