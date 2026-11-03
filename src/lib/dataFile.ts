import * as DocumentPicker from 'expo-document-picker';

/** The text of a data file the seller picks, or null if they back out. */
export async function pickDataText(): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets?.length) return null;
  return (await fetch(picked.assets[0].uri)).text();
}
