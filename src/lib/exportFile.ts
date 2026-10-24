import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes a file and opens the share sheet so the seller can send or save it. */
export async function shareTextFile(name: string, contents: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}
