/**
 * The computer version's working core. It reads the backup the phone keeps in the seller's Drive,
 * changes it in small steps, and writes it back as the next revision, marked as written by the computer.
 *
 * Each change is applied to the newest copy on Drive, not to what the screen last showed, so a change
 * made on the phone a moment ago is kept and the seller's click lands on top of it. Changes are made
 * one at a time.
 */
import { rewriteBackup, type Backup, type BackupData } from './backup';

export interface DeskPort {
  /** The backup on Drive, or null when there is none. */
  read(): Promise<Backup | null>;
  write(backup: Backup): Promise<void>;
}

export interface Desk {
  load(): Promise<Backup>;
  /** Applies one change to the newest copy and saves it. Resolves with what was saved. */
  commit(change: (d: BackupData) => BackupData): Promise<{ backup: Backup; fresher: boolean }>;
}

export const NO_BACKUP = 'There is no Skrybix backup in this Google account yet. Open Skrybix on your phone, connect Google Drive and back up once.';

export function createDesk(port: DeskPort, now: () => number = Date.now): Desk {
  let seen = -1;
  let queue: Promise<unknown> = Promise.resolve();

  const load = async () => {
    const b = await port.read();
    if (!b) throw new Error(NO_BACKUP);
    seen = b.revision;
    return b;
  };

  return {
    load,
    commit(change) {
      const run = async () => {
        const latest = await load0();
        const fresher = latest.revision !== seen;
        const saved = rewriteBackup(latest, change(latest.data), { now: now() });
        await port.write(saved);
        seen = saved.revision;
        return { backup: saved, fresher };
      };
      const load0 = async () => {
        const b = await port.read();
        if (!b) throw new Error(NO_BACKUP);
        return b;
      };
      const next = queue.then(run, run);
      queue = next.catch(() => undefined);
      return next;
    },
  };
}
