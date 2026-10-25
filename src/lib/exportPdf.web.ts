import { shareTextFile } from './exportFile';

// Browsers get the page itself; it opens and prints anywhere.
export async function sharePdf(name: string, html: string): Promise<void> {
  await shareTextFile(name.replace(/\.pdf$/, '.html'), html, 'text/html');
}
