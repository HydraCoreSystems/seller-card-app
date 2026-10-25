import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** Prints the page to a PDF and opens the share sheet, so the seller can save it to Drive or send it. */
export async function sharePdf(name: string, html: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  new File(uri).moveSync(file);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: name });
}
