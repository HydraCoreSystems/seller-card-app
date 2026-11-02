/**
 * Running a backup and a restore against the seller's Drive. The Drive and the phone's photo folder
 * are passed in as small ports, so every rule here is tested with in memory stand ins.
 *
 * The rules: photos are written before the data file, so the data never points at a photo that is
 * missing. A write first checks the revision on Drive against the one this phone last wrote. If they
 * differ, another device (or a fresh install) has changed the backup, and nothing is overwritten until
 * the seller chooses.
 */
import {
  BACKUP_FILE,
  packBackup,
  parseBackup,
  unpackData,
  type Backup,
  type BackupData,
} from './backup';

export interface DrivePort {
  folder(create: boolean): Promise<string | null>;
  files(folderId: string): Promise<Map<string, string>>;
  readText(id: string): Promise<string>;
  readBytes(id: string): Promise<ArrayBuffer>;
  writeText(folderId: string, name: string, text: string, existingId?: string): Promise<{ id: string }>;
  writePhoto(folderId: string, name: string, bytes: Uint8Array): Promise<{ id: string }>;
}

export interface PhotoPort {
  /** The photos folder on this phone, no trailing slash. */
  dir: string;
  read(name: string): Promise<Uint8Array | null>;
  has(name: string): boolean;
  write(name: string, bytes: Uint8Array): Promise<void>;
}

export type BackupResult =
  | { status: 'ok'; revision: number; savedAt: string }
  | { status: 'changed'; revision: number; savedAt: string; savedBy: 'phone' | 'computer' }
  | { status: 'newer'; message: string };

/**
 * Backs the data up. `lastRevision` is the revision this phone last wrote or restored, or null when
 * it has never done either. `force` replaces whatever is on Drive, for when the seller chose to.
 */
export async function runBackup(
  drive: DrivePort,
  photos: PhotoPort,
  data: BackupData,
  opts: { lastRevision: number | null; now: number; force?: boolean },
): Promise<BackupResult> {
  const folderId = (await drive.folder(true)) as string;
  const files = await drive.files(folderId);
  const existingId = files.get(BACKUP_FILE);

  let remoteRevision = 0;
  if (existingId) {
    const remote = parseBackup(await drive.readText(existingId));
    if (!remote.ok && /newer Skrybix/.test(remote.error)) return { status: 'newer', message: remote.error };
    if (remote.ok) {
      remoteRevision = remote.backup.revision;
      if (!opts.force && opts.lastRevision !== remote.backup.revision) {
        return { status: 'changed', revision: remote.backup.revision, savedAt: remote.backup.savedAt, savedBy: remote.backup.savedBy };
      }
    }
  }

  const backup = packBackup(data, { revision: Math.max(remoteRevision, opts.lastRevision ?? 0) + 1, now: opts.now });
  // Photos first. A photo never changes once saved, so one already on Drive is left alone.
  for (const name of backup.photos) {
    if (files.has(name)) continue;
    const bytes = await photos.read(name);
    if (bytes) await drive.writePhoto(folderId, name, bytes);
  }
  await drive.writeText(folderId, BACKUP_FILE, JSON.stringify(backup), existingId);
  return { status: 'ok', revision: backup.revision, savedAt: backup.savedAt };
}

export interface Found {
  backup: Backup;
  files: Map<string, string>;
}

/** The backup on Drive, or null when there is none. Throws the message to show when it cannot be used. */
export async function findBackup(drive: DrivePort): Promise<Found | null> {
  const folderId = await drive.folder(false);
  if (!folderId) return null;
  const files = await drive.files(folderId);
  const id = files.get(BACKUP_FILE);
  if (!id) return null;
  const parsed = parseBackup(await drive.readText(id));
  if (!parsed.ok) throw new Error(parsed.error);
  return { backup: parsed.backup, files };
}

/** Brings the photos down that this phone is missing, and returns the data with this phone's photo addresses. */
export async function restoreBackup(drive: DrivePort, photos: PhotoPort, found: Found): Promise<BackupData> {
  for (const name of found.backup.photos) {
    if (photos.has(name)) continue;
    const id = found.files.get(name);
    if (!id) continue;
    await photos.write(name, new Uint8Array(await drive.readBytes(id)));
  }
  return unpackData(found.backup, photos.dir);
}
