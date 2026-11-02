/**
 * The phone's side of the Drive backup: the photo folder, the saved state, and the calls into the
 * logic in core/backupRun.ts. Nothing here decides anything. The rules live in core and are tested.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { EMPTY_BACKUP_DATA, digest, type BackupData } from '../core/backup';
import { findBackup, restoreBackup, runBackup, type BackupResult, type Found, type PhotoPort } from '../core/backupRun';
import { createDrive } from '../core/drive';
import { getAccessToken } from './googleAuth';
import { loadJson, saveJson } from './storage';

const STATE_KEY = 'backup.v1';

/** What this phone remembers: the revision it last wrote or restored, and when. */
export interface BackupState {
  lastRevision: number | null;
  lastAt: number | null;
  /** A short stamp of the data that was last backed up, so an unchanged phone does not write again. */
  stamp?: string | null;
}

export const loadBackupState = (): BackupState => loadJson<BackupState>(STATE_KEY, { lastRevision: null, lastAt: null, stamp: null });
const saveBackupState = (s: BackupState) => saveJson(STATE_KEY, s);

function photoDir(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function photoPort(): PhotoPort {
  const dir = photoDir();
  return {
    dir: dir.uri.replace(/\/$/, ''),
    has: (name) => new File(dir, name).exists,
    read: async (name) => {
      const f = new File(dir, name);
      return f.exists ? new Uint8Array(await f.arrayBuffer()) : null;
    },
    write: async (name, bytes) => {
      const f = new File(dir, name);
      if (!f.exists) f.create();
      f.write(bytes);
    },
  };
}

const drive = () => createDrive(getAccessToken);

/** Backs up now. Remembers the new revision when it worked. */
export async function backupNow(data: BackupData, pro: boolean, force = false): Promise<BackupResult> {
  const state = loadBackupState();
  const result = await runBackup(drive(), photoPort(), data, { lastRevision: state.lastRevision, now: Date.now(), force, pro });
  if (result.status === 'ok') saveBackupState({ lastRevision: result.revision, lastAt: Date.now(), stamp: digest(data) });
  return result;
}

/** The backup on Drive, or null when there is none. */
export const findRemoteBackup = (): Promise<Found | null> => findBackup(drive());

/** Pulls the backup down and remembers its revision, so the next backup carries on from it. */
export async function restoreRemote(found: Found): Promise<{ data: BackupData; missingPhotos: number }> {
  const { data, missingPhotos } = await restoreBackup(drive(), photoPort(), found);
  saveBackupState({ lastRevision: found.backup.revision, lastAt: Date.now(), stamp: null });
  return { data: { ...EMPTY_BACKUP_DATA, ...data }, missingPhotos };
}

/** Forgets what this phone knew about the backup, for a disconnect. */
export const forgetBackupState = () => saveBackupState({ lastRevision: null, lastAt: null, stamp: null });
