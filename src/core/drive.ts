/**
 * A small Google Drive client for the seller's own backup. It works through plain HTTPS calls to
 * Drive's v3 API with the seller's own access token, and holds no server of ours in the middle. The
 * only scope it needs is drive.file, which lets the app see only the files it made itself, so it can
 * never read anything else in the seller's Drive.
 *
 * The network call and the token are passed in, so the logic is tested with a stand in for both.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_TYPE = 'application/vnd.google-apps.folder';

export class DriveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface DriveFile {
  id: string;
  name: string;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Bytes to base64, without needing a Buffer, so it runs on the phone as it does in tests. */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[c & 63] : '=';
  }
  return out;
}

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** The body of a Drive multipart upload: the file's details, then its content. */
export function multipartBody(boundary: string, meta: object, mime: string, content: string, base64: boolean): string {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(meta),
    `--${boundary}`,
    `Content-Type: ${mime}`,
    ...(base64 ? ['Content-Transfer-Encoding: base64'] : []),
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

export function createDrive(getToken: () => Promise<string>, doFetch: Fetch = fetch) {
  const call = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const send = async (token: string) => doFetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
    let res = await send(await getToken());
    // A token can run out between asking for it and using it. Ask once more.
    if (res.status === 401) res = await send(await getToken());
    if (!res.ok) throw new DriveError(res.status, `Drive answered ${res.status}`);
    return res;
  };

  const list = async (q: string): Promise<DriveFile[]> => {
    const res = await call(`${API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent('files(id,name)')}&pageSize=1000&spaces=drive`);
    return ((await res.json()) as { files?: DriveFile[] }).files ?? [];
  };

  const upload = async (folderId: string, name: string, mime: string, content: string, base64: boolean, existingId?: string): Promise<DriveFile> => {
    const boundary = `skrybix${Math.random().toString(36).slice(2)}`;
    const meta = existingId ? { name } : { name, parents: [folderId] };
    const url = existingId ? `${UPLOAD}/files/${existingId}?uploadType=multipart&fields=id,name` : `${UPLOAD}/files?uploadType=multipart&fields=id,name`;
    const res = await call(url, {
      method: existingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartBody(boundary, meta, mime, content, base64),
    });
    return (await res.json()) as DriveFile;
  };

  return {
    /** The Skrybix folder, made on first use. Null when `create` is false and there is none. */
    async folder(create: boolean): Promise<string | null> {
      const found = await list(`name = ${quote('Skrybix')} and mimeType = ${quote(FOLDER_TYPE)} and trashed = false`);
      if (found.length) return found[0].id;
      if (!create) return null;
      const res = await call(`${API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Skrybix', mimeType: FOLDER_TYPE }),
      });
      return ((await res.json()) as { id: string }).id;
    },

    /** Every file in the folder, by name. */
    async files(folderId: string): Promise<Map<string, string>> {
      const found = await list(`${quote(folderId)} in parents and trashed = false`);
      return new Map(found.map((f) => [f.name, f.id]));
    },

    async readText(id: string): Promise<string> {
      return (await call(`${API}/files/${id}?alt=media`)).text();
    },

    async readBytes(id: string): Promise<ArrayBuffer> {
      return (await call(`${API}/files/${id}?alt=media`)).arrayBuffer();
    },

    /** Writes a text file, replacing the one with the same name when it is there. */
    writeText(folderId: string, name: string, text: string, existingId?: string): Promise<DriveFile> {
      return upload(folderId, name, 'application/json', text, false, existingId);
    },

    /** Writes a photo. Photos never change once saved, so an existing one is left alone by the caller. */
    writePhoto(folderId: string, name: string, bytes: Uint8Array): Promise<DriveFile> {
      const mime = /\.png$/i.test(name) ? 'image/png' : 'image/jpeg';
      return upload(folderId, name, mime, toBase64(bytes), true);
    },
  };
}

export type Drive = ReturnType<typeof createDrive>;
