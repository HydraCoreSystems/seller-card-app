import { extractTextFromImage, isSupported } from 'expo-text-extractor';
import * as ImagePicker from 'expo-image-picker';

/** True when this device can read text out of a picture. It all happens on the device. */
export const ocrAvailable: boolean = isSupported;

export interface ScreenRead {
  /** What was read from each screenshot, in the order the seller picked them. */
  screens: string[][];
  /** How many screenshots the device could not read. Their place stays, empty, so the order holds. */
  failed: number;
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
      screens.push(await extractTextFromImage(asset.uri));
    } catch {
      screens.push([]);
      failed += 1;
    }
  }
  return { screens, failed };
}
