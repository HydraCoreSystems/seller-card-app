import { BACKUP_FILE, parseBackup } from '../core/backup';
import { writeBackup, type DrivePort } from '../core/backupRun';
import type { DeskPort } from '../core/desk';

/** The desk's way of reading and writing the one backup file in the seller's Drive. */
export function driveDeskPort(drive: DrivePort): DeskPort {
  return {
    async read() {
      const folderId = await drive.folder(false);
      if (!folderId) return null;
      const id = (await drive.files(folderId)).get(BACKUP_FILE);
      if (!id) return null;
      const parsed = parseBackup(await drive.readText(id));
      if (!parsed.ok) throw new Error(parsed.error);
      return parsed.backup;
    },
    write: (backup) => writeBackup(drive, backup),
  };
}
