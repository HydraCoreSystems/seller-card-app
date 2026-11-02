import { describe, expect, it } from 'vitest';
import {
  BACKUP_FILE,
  BACKUP_GAP_MS,
  BACKUP_VERSION,
  EMPTY_BACKUP_DATA,
  PHOTO_PREFIX,
  hasData,
  packBackup,
  parseBackup,
  photoName,
  shouldBackUp,
  summary,
  unpackData,
  type BackupData,
} from '../src/core/backup';
import { findBackup, restoreBackup, runBackup, type DrivePort, type PhotoPort } from '../src/core/backupRun';
import { DRIVE_SCOPE, DriveError, createDrive, multipartBody, toBase64 } from '../src/core/drive';
import type { Plant, Sale } from '../src/core/types';

const plant = (id: string, uris: string[]): Plant =>
  ({ id, name: id, noid: false, price: 10, kind: 'sale', photoUri: uris[0] ?? null, photoUris: uris, notes: '', sold: false, createdAt: '2026-11-01' }) as Plant;
const DIR = 'file:///var/mobile/Containers/Data/ABC/Documents/photos';
const data = (): BackupData => ({
  ...EMPTY_BACKUP_DATA,
  profile: { sellerName: 'Fern', sellerNumber: '1', shipping: '', shippingDays: [], payment: '', timeZone: '', claimRules: '', defaultFormat: 'generic' } as never,
  plants: [plant('p1', [`${DIR}/a1.jpg`, `${DIR}/a2.jpg`]), plant('p2', [])],
  sales: [{ id: 's1', lots: [{ number: 1, photoUri: `${DIR}/a1.jpg`, photoUris: [`${DIR}/a1.jpg`] }] } as unknown as Sale],
  buyerNotes: { jada: 'Pays fast' },
});

describe('the backup file', () => {
  it('stores photo addresses as portable names, and lists each photo once', () => {
    const b = packBackup(data(), { revision: 1, now: Date.parse('2026-11-01T12:00:00Z') });
    expect(b.version).toBe(BACKUP_VERSION);
    expect(b.photos).toEqual(['a1.jpg', 'a2.jpg']);
    expect(JSON.stringify(b.data)).not.toContain('/var/mobile');
    expect(b.data.plants[0].photoUris).toEqual([`${PHOTO_PREFIX}a1.jpg`, `${PHOTO_PREFIX}a2.jpg`]);
    expect(b.data.sales[0].lots[0].photoUri).toBe(`${PHOTO_PREFIX}a1.jpg`);
    expect(b.savedAt).toBe('2026-11-01T12:00:00.000Z');
  });

  it('round trips onto a phone whose photo folder is somewhere else', () => {
    const packed = packBackup(data(), { revision: 3, now: 0 });
    const parsed = parseBackup(JSON.stringify(packed));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const back = unpackData(parsed.backup, 'file:///new/place/photos');
    expect(back.plants[0].photoUris).toEqual(['file:///new/place/photos/a1.jpg', 'file:///new/place/photos/a2.jpg']);
    expect(back.sales[0].lots[0].photoUri).toBe('file:///new/place/photos/a1.jpg');
    expect(back.buyerNotes).toEqual({ jada: 'Pays fast' });
    expect(back.plants[1].photoUri).toBeNull();
  });

  it('only treats the app photo folder as photos', () => {
    expect(photoName('file:///x/Documents/photos/abc.jpg')).toBe('abc.jpg');
    expect(photoName('https://example.com/photos/abc.jpg')).toBeNull();
    expect(photoName('file:///x/other/abc.jpg')).toBeNull();
    expect(photoName('Photos of my hoya')).toBeNull();
  });

  it('refuses what is not a backup, and a newer layout, with plain words', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'The backup file could not be read.' });
    expect(parseBackup('{"hello":1}')).toMatchObject({ ok: false, error: 'That file is not a Skrybix backup.' });
    const newer = parseBackup(JSON.stringify({ app: 'skrybix', version: BACKUP_VERSION + 1 }));
    expect(newer).toMatchObject({ ok: false });
    expect((newer as { error: string }).error).toMatch(/newer Skrybix/);
  });

  it('fills what an older or sparse file leaves out', () => {
    const p = parseBackup(JSON.stringify({ app: 'skrybix', version: 1, data: { plants: [plant('x', [])] } }));
    expect(p.ok && p.backup.data.sales).toEqual([]);
    expect(p.ok && p.backup.revision).toBe(0);
    expect(p.ok && p.backup.savedBy).toBe('phone');
  });

  it('knows when there is data worth protecting, and says what a backup holds', () => {
    expect(hasData(EMPTY_BACKUP_DATA)).toBe(false);
    expect(hasData(data())).toBe(true);
    expect(summary(packBackup(data(), { revision: 1, now: 0 }))).toBe('2 plants, 1 showcase, 0 sale records');
  });
});

describe('when to back up', () => {
  const base = { connected: true, allowed: true, dirty: true, lastAt: 0, now: BACKUP_GAP_MS, closedNow: false, blocked: false };
  it('waits out the gap, except right after a sale closes', () => {
    expect(shouldBackUp(base)).toBe(true);
    expect(shouldBackUp({ ...base, now: BACKUP_GAP_MS - 1 })).toBe(false);
    expect(shouldBackUp({ ...base, now: 5, closedNow: true })).toBe(true);
    expect(shouldBackUp({ ...base, lastAt: null, now: 5 })).toBe(true);
  });
  it('does nothing when unconnected, not allowed, unchanged or blocked', () => {
    for (const off of [{ connected: false }, { allowed: false }, { dirty: false }, { blocked: true }]) expect(shouldBackUp({ ...base, closedNow: true, ...off })).toBe(false);
  });
});

/** An in memory Drive and photo folder. */
function fakes() {
  const files = new Map<string, { id: string; text?: string; bytes?: Uint8Array }>();
  let hasFolder = false;
  const writes: string[] = [];
  const drive: DrivePort = {
    folder: async (create) => (hasFolder || (create && (hasFolder = true)) ? 'folder1' : null),
    files: async () => new Map([...files].map(([n, f]) => [n, f.id])),
    readText: async (id) => [...files.values()].find((f) => f.id === id)!.text!,
    readBytes: async (id) => {
      const b = [...files.values()].find((f) => f.id === id)!.bytes!;
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    },
    writeText: async (_f, name, text) => {
      writes.push(name);
      const id = files.get(name)?.id ?? `id-${name}`;
      files.set(name, { id, text });
      return { id };
    },
    writePhoto: async (_f, name, bytes) => {
      writes.push(name);
      files.set(name, { id: `id-${name}`, bytes });
      return { id: `id-${name}` };
    },
  };
  const local = new Map<string, Uint8Array>([['a1.jpg', new Uint8Array([1, 2, 3])], ['a2.jpg', new Uint8Array([4, 5])]]);
  const photos: PhotoPort = {
    dir: DIR,
    read: async (n) => local.get(n) ?? null,
    has: (n) => local.has(n),
    write: async (n, b) => void local.set(n, b),
  };
  return { drive, photos, files, local, writes };
}

describe('running a backup', () => {
  it('writes the photos before the data, and the first backup is revision 1', async () => {
    const f = fakes();
    const r = await runBackup(f.drive, f.photos, data(), { lastRevision: null, now: 1 });
    expect(r).toMatchObject({ status: 'ok', revision: 1 });
    expect(f.writes).toEqual(['a1.jpg', 'a2.jpg', BACKUP_FILE]);
  });

  it('writes only what is new the next time, and bumps the revision', async () => {
    const f = fakes();
    await runBackup(f.drive, f.photos, data(), { lastRevision: null, now: 1 });
    f.writes.length = 0;
    const r = await runBackup(f.drive, f.photos, data(), { lastRevision: 1, now: 2 });
    expect(r).toMatchObject({ status: 'ok', revision: 2 });
    expect(f.writes).toEqual([BACKUP_FILE]);
  });

  it('stops and writes nothing when another device changed the backup', async () => {
    const f = fakes();
    await runBackup(f.drive, f.photos, data(), { lastRevision: null, now: 1 });
    const remote = JSON.parse(f.files.get(BACKUP_FILE)!.text!);
    f.files.get(BACKUP_FILE)!.text = JSON.stringify({ ...remote, revision: 5, savedBy: 'computer' });
    f.writes.length = 0;
    const r = await runBackup(f.drive, f.photos, data(), { lastRevision: 1, now: 3 });
    expect(r).toMatchObject({ status: 'changed', revision: 5, savedBy: 'computer' });
    expect(f.writes).toEqual([]);
    const forced = await runBackup(f.drive, f.photos, data(), { lastRevision: 1, now: 4, force: true });
    expect(forced).toMatchObject({ status: 'ok', revision: 6 });
  });

  it('treats a fresh install meeting an existing backup as a change, never an overwrite', async () => {
    const f = fakes();
    await runBackup(f.drive, f.photos, data(), { lastRevision: null, now: 1 });
    const second = fakes();
    second.files.set(BACKUP_FILE, f.files.get(BACKUP_FILE)!);
    expect(await runBackup(second.drive, second.photos, EMPTY_BACKUP_DATA, { lastRevision: null, now: 2 })).toMatchObject({ status: 'changed' });
  });

  it('will not write over a backup from a newer Skrybix', async () => {
    const f = fakes();
    await runBackup(f.drive, f.photos, data(), { lastRevision: null, now: 1 });
    f.files.get(BACKUP_FILE)!.text = JSON.stringify({ app: 'skrybix', version: 99 });
    expect(await runBackup(f.drive, f.photos, data(), { lastRevision: 1, now: 2, force: true })).toMatchObject({ status: 'newer' });
  });
});

describe('restoring', () => {
  it('finds nothing when there is no backup, and rebuilds data and photos on a fresh phone', async () => {
    const f = fakes();
    expect(await findBackup(f.drive)).toBeNull();
    await runBackup(f.drive, f.photos, data(), { lastRevision: null, now: 1 });
    const found = await findBackup(f.drive);
    expect(found?.backup.revision).toBe(1);

    const fresh = fakes();
    fresh.local.clear();
    const restored = await restoreBackup(f.drive, { ...fresh.photos, dir: 'file:///new/photos' }, found!);
    expect(restored.plants[0].photoUris).toEqual(['file:///new/photos/a1.jpg', 'file:///new/photos/a2.jpg']);
    expect([...fresh.local.keys()].sort()).toEqual(['a1.jpg', 'a2.jpg']);
    expect([...(fresh.local.get('a1.jpg') ?? [])]).toEqual([1, 2, 3]);
    expect(restored.buyerNotes.jada).toBe('Pays fast');
  });
});

describe('the Drive client', () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  it('only asks for the scope that sees its own files', () => {
    expect(DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file');
  });

  it('finds the folder, or makes it, and sends the token', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const answers = [ok({ files: [] }), ok({ id: 'new-folder' })];
    const drive = createDrive(async () => 'tok', async (url, init) => {
      calls.push({ url, init });
      return answers.shift()!;
    });
    expect(await drive.folder(true)).toBe('new-folder');
    expect(decodeURIComponent(calls[0].url)).toContain("name = 'Skrybix'");
    expect(calls[1].init?.method).toBe('POST');
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('reports no folder without making one when asked not to', async () => {
    const drive = createDrive(async () => 't', async () => ok({ files: [] }));
    expect(await drive.folder(false)).toBeNull();
  });

  it('asks for a fresh token once on a 401, then gives up with the status', async () => {
    let n = 0;
    const tokens = ['old', 'new'];
    const seen: string[] = [];
    const drive = createDrive(async () => tokens[Math.min(n++, 1)], async (_u, init) => {
      seen.push((init?.headers as Record<string, string>).Authorization);
      return seen.length === 1 ? new Response('', { status: 401 }) : ok({ files: [] });
    });
    expect(await drive.folder(false)).toBeNull();
    expect(seen).toEqual(['Bearer old', 'Bearer new']);
    const bad = createDrive(async () => 't', async () => new Response('', { status: 403 }));
    await expect(bad.folder(false)).rejects.toBeInstanceOf(DriveError);
  });

  it('updates a file in place and creates it in the folder otherwise', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const drive = createDrive(async () => 't', async (url, init) => {
      calls.push({ url, init });
      return ok({ id: 'x', name: 'n' });
    });
    await drive.writeText('f1', BACKUP_FILE, '{}');
    await drive.writeText('f1', BACKUP_FILE, '{}', 'old-id');
    expect(calls[0].init?.method).toBe('POST');
    expect(String(calls[0].init?.body)).toContain('"parents":["f1"]');
    expect(calls[1].init?.method).toBe('PATCH');
    expect(calls[1].url).toContain('/files/old-id?uploadType=multipart');
    expect(String(calls[1].init?.body)).not.toContain('parents');
  });

  it('encodes photo bytes as base64 in the multipart body', async () => {
    expect(toBase64(new Uint8Array([72, 105]))).toBe('SGk=');
    expect(toBase64(new Uint8Array([1, 2, 3]))).toBe('AQID');
    expect(toBase64(new Uint8Array([]))).toBe('');
    expect(multipartBody('B', { name: 'a.jpg' }, 'image/jpeg', 'AQID', true)).toContain('Content-Transfer-Encoding: base64');
  });
});

describe('backup extras', () => {
  it('stamps the data so an unchanged phone skips the write', async () => {
    const { digest, EMPTY_BACKUP_DATA } = await import('../src/core/backup');
    const a = digest(EMPTY_BACKUP_DATA);
    expect(digest({ ...EMPTY_BACKUP_DATA })).toBe(a);
    expect(digest({ ...EMPTY_BACKUP_DATA, leftoversDone: ['x'] })).not.toBe(a);
  });

  it('keeps the backup words free of dashes', async () => {
    const copy = await import('../src/core/backupCopy');
    for (const text of Object.values(copy)) expect(/—|–|--/.test(text)).toBe(false);
  });
});
