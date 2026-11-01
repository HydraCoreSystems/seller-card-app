import { isPlainFormLink, saleEntryFromFormHtml, taggedFormLink } from '../core/checkout';

/** The seller's own form page as text, read straight from Google with no sign in and no cookies. Null on any failure. */
async function readFormPage(url: string, timeoutMs = 8000): Promise<string | null> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: stop.signal, credentials: 'omit' });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Builds the sale name tagged link from a plain form link, by reading the form page and finding the
 * Sale name question. Only a Google Forms viewform link is ever fetched. Null when the page can't be
 * read or has no Sale name question, and then the seller makes the link by hand. A browser preview
 * can't read Google's pages across sites, so it always lands on the manual route.
 */
export async function buildTaggedLink(plain: string, readPage: (url: string) => Promise<string | null> = readFormPage): Promise<string | null> {
  if (!isPlainFormLink(plain)) return null;
  const html = await readPage(plain.trim());
  const entry = html ? saleEntryFromFormHtml(html) : null;
  return entry ? taggedFormLink(plain, entry) : null;
}
