import * as Clipboard from 'expo-clipboard';

/** The text on the clipboard, or null when there is none or it cannot be read. */
export async function clipboardText(): Promise<string | null> {
  try {
    if (!(await Clipboard.hasStringAsync())) return null;
    return (await Clipboard.getStringAsync()) || null;
  } catch {
    return null;
  }
}
