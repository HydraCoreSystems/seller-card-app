/**
 * Data tools: a copy of everything as one file the seller can keep or send, and a restore from such a file.
 * The file is the same format as the Drive backup, so either one can be restored from the other.
 */
import { EMPTY_BACKUP_DATA, dropMissingPhotos, packBackup, parseBackup, unpackData, type BackupData } from './backup';

export const EXPORT_FILE_NAME = 'skrybix-data.json';

/** Everything the seller keeps, as the text of one file. */
export function exportText(data: BackupData, opts: { now: number; pro: boolean }): string {
  return JSON.stringify(packBackup(data, { revision: 0, now: opts.now, pro: opts.pro }));
}

export type FileRestore = { ok: true; data: BackupData; missingPhotos: number; savedAt: string } | { ok: false; error: string };

/**
 * Reads a file the seller picked. Photos stay on the phone, so any photo the file names that this
 * phone does not have is left out of the data and counted, so the seller can be told.
 */
export function restoreText(text: string, photos: { dir: string; has: (name: string) => boolean }): FileRestore {
  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;
  const missing = new Set(parsed.backup.photos.filter((n) => !photos.has(n)));
  const cut = dropMissingPhotos(unpackData(parsed.backup, photos.dir), photos.dir, missing);
  return { ok: true, data: { ...EMPTY_BACKUP_DATA, ...cut.data }, missingPhotos: cut.dropped, savedAt: parsed.backup.savedAt };
}
