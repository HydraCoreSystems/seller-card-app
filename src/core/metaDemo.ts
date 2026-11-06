/**
 * The Meta App Review demonstration: connect a Facebook Page, watch its own posts and their comments.
 *
 * Everything here is plain logic with no network and no phone APIs, so it can be tested. The app ID
 * and the Facebook Login for Business configuration ID are public identifiers, not secrets. There is
 * no app secret and no server of ours anywhere in this flow, and tokens never leave the phone.
 *
 * This is the Page timeline branch only. Comments inside Facebook groups cannot be read afterward,
 * so nothing here touches groups. Meta times are whole seconds, so two comments in the same second
 * cannot be ordered by time. They are flagged as the same second, with the order unresolved, and
 * this file never invents an order for them.
 *
 * The one thing that writes is the demonstration sale: a post on the seller's chosen Page and one
 * comment per lot under it. That runs only from the create screen, on the Page the seller picked,
 * and only when the seller presses the button.
 */
import { isPhil } from './variant';
import config from './metaConfig.json';

export const META_APP_ID: string = config.appId;
export const META_CONFIG_ID: string = config.configId;
export const GRAPH_VERSION: string = config.graphVersion;

export const GRAPH_HOST = 'https://graph.facebook.com';
export const LOGIN_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

/**
 * Where Facebook sends the seller after sign in: a page on the shop, a web address that the Facebook
 * Login web settings accept with no native platform entry. That page hands the result on to the app.
 */
export const META_RETURN_URL: string = config.returnUrl;

/**
 * The link the shop page opens to hand the result into the app. The app listens for it, and the
 * browser view watching for it closes when it arrives. Facebook itself never sees this address.
 */
export const META_APP_LINK = `fb${META_APP_ID}://authorize`;
/** The URL scheme a build must register to receive that link. */
export const META_URL_SCHEME = `fb${META_APP_ID}`;

/**
 * The implicit return: Facebook puts a user access token in the web address and the app needs no
 * secret to use it. The other kind, a code, can only be traded for a token with the app secret, and
 * the app carries none.
 */
export const META_RESPONSE_TYPE = 'token';

/** How long a started sign in stays good, in milliseconds. */
export const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;

/** The Facebook sign in address for this app, with the state the return must bring back. No scope is sent: the configuration carries the permissions. */
export function buildLoginUrl(state: string): string {
  const query = [
    ['client_id', META_APP_ID],
    ['redirect_uri', META_RETURN_URL],
    ['response_type', META_RESPONSE_TYPE],
    ['config_id', META_CONFIG_ID],
    ['state', state],
  ]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${LOGIN_DIALOG}?${query}`;
}

/** True for the link the shop page uses to hand a sign in back to the app. */
export const isAppLink = (url: string | null | undefined): url is string =>
  !!url && url.toLowerCase().startsWith(META_APP_LINK.toLowerCase());

export interface SignInReturn {
  state: string | null;
  accessToken: string | null;
  code: string | null;
  error: string | null;
}

const decode = (v: string): string => {
  try {
    return decodeURIComponent(v.replace(/\+/g, ' '));
  } catch {
    return v;
  }
};

const pairs = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const part of text.split('&')) {
    if (!part) continue;
    const at = part.indexOf('=');
    const key = decode(at < 0 ? part : part.slice(0, at));
    if (key && !(key in out)) out[key] = at < 0 ? '' : decode(part.slice(at + 1));
  }
  return out;
};

/**
 * Reads what came back, from the query string, from the fragment, or both. The shop page may hand
 * on either, so the app takes the value from wherever it is.
 */
export function parseReturn(url: string): SignInReturn {
  const hash = url.indexOf('#');
  const beforeHash = hash < 0 ? url : url.slice(0, hash);
  const q = beforeHash.indexOf('?');
  const fromQuery = q < 0 ? {} : pairs(beforeHash.slice(q + 1));
  const fromHash = hash < 0 ? {} : pairs(url.slice(hash + 1));
  const pick = (k: string): string | null => fromQuery[k] || fromHash[k] || null;
  return { state: pick('state'), accessToken: pick('access_token'), code: pick('code'), error: pick('error') };
}

export interface PendingSignIn {
  state: string;
  at: number;
}

export type ReturnCheck =
  | { kind: 'token'; token: string }
  | { kind: 'code'; code: string }
  | { kind: 'denied' }
  | { kind: 'stale' }
  | { kind: 'mismatch' }
  | { kind: 'empty' };

/**
 * Decides what a return means, before anything is trusted. It must carry the state this app started
 * the sign in with, and arrive while that sign in is still good. A link with no sign in waiting for
 * it is stale, and is ignored without a word. A link with the wrong state is refused.
 */
export function checkReturn(ret: SignInReturn, pending: PendingSignIn | null, now: number): ReturnCheck {
  if (!pending || now - pending.at > SIGN_IN_WINDOW_MS) return { kind: 'stale' };
  if (!ret.state || ret.state !== pending.state) return { kind: 'mismatch' };
  if (ret.error) return { kind: 'denied' };
  if (ret.accessToken) return { kind: 'token', token: ret.accessToken };
  if (ret.code) return { kind: 'code', code: ret.code };
  return { kind: 'empty' };
}

/** The demonstration lives in Phil's build only. The store build and the closed test build never reach it. */
export const metaDemoEnabled = (): boolean => isPhil();

/** How often the open comment list asks Facebook for anything new. */
export const POLL_MS = 5000;
/** How many comment pages one refresh will follow. */
export const MAX_PAGES = 5;

/** A Graph API address, with the parameters encoded. The token goes in the header, never in the address. */
export function graphUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  const clean = path.replace(/^\/+/, '');
  return `${GRAPH_HOST}/${GRAPH_VERSION}/${clean}${query ? `?${query}` : ''}`;
}

export interface MetaPage {
  id: string;
  name: string;
  /** The Page's own access token, from the Pages list. Kept on this phone only. */
  token: string;
}

export interface MetaPost {
  id: string;
  /** What the post says, or a short stand in for a post with no words. */
  text: string;
  createdIso: string;
  createdSec: number | null;
  link: string | null;
}

export interface MetaComment {
  id: string;
  /** The commenter's name, or null when Facebook did not give one. */
  from: string | null;
  message: string;
  createdIso: string;
  /** Whole seconds since 1970, from Meta's own created time. Null if it could not be read. */
  createdSec: number | null;
}

/** A comment as listed, with its same second flag. */
export interface CommentRow extends MetaComment {
  /** How many comments share this exact second. 1 means it stands alone. */
  sameSecond: number;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Reads Meta's created time, like 2026-11-06T17:56:36+0000, to whole seconds. Never guesses. */
export function parseGraphTime(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.exec(iso);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, zone] = m;
  let offsetMin = 0;
  if (zone !== 'Z') {
    const digits = zone.replace(':', '');
    offsetMin = (digits[0] === '-' ? -1 : 1) * (Number(digits.slice(1, 3)) * 60 + Number(digits.slice(3, 5)));
  }
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return Math.floor(ms / 1000) - offsetMin * 60;
}

export function readPages(json: unknown): MetaPage[] {
  return list(obj(json).data)
    .map((row) => obj(row))
    .filter((p) => str(p.id) && str(p.name) && str(p.access_token))
    .map((p) => ({ id: str(p.id), name: str(p.name), token: str(p.access_token) }));
}

export function readPosts(json: unknown): MetaPost[] {
  return list(obj(json).data)
    .map((row) => obj(row))
    .filter((p) => str(p.id))
    .map((p) => {
      const createdIso = str(p.created_time);
      return {
        id: str(p.id),
        text: str(p.message) || str(p.story) || 'A post with no words',
        createdIso,
        createdSec: parseGraphTime(createdIso),
        link: str(p.permalink_url) || null,
      };
    });
}

/** Comments in the order Facebook returned them. */
export function readComments(json: unknown): MetaComment[] {
  return list(obj(json).data)
    .map((row) => obj(row))
    .filter((c) => str(c.id))
    .map((c) => {
      const createdIso = str(c.created_time);
      return {
        id: str(c.id),
        from: str(obj(c.from).name) || null,
        message: str(c.message),
        createdIso,
        createdSec: parseGraphTime(createdIso),
      };
    });
}

/** The address of the next page of results, if Facebook gave one. */
export function nextPage(json: unknown): string | null {
  return str(obj(obj(json).paging).next) || null;
}

/**
 * Puts comments in arrival order and flags the ones that share a second.
 *
 * Order is Meta's created time. Comments that came back in the same second keep the order they were
 * first seen in, only so the list does not jump about on screen, and every one of them carries the
 * same second flag. That order is a display convenience and is never presented as the true order.
 * `seen` is the order of ids from earlier refreshes.
 */
export function arrange(comments: MetaComment[], seen: string[] = []): CommentRow[] {
  const known = new Map(seen.map((id, i) => [id, i]));
  const rank = (c: MetaComment, i: number) => (known.has(c.id) ? (known.get(c.id) as number) : seen.length + i);
  const counts = new Map<number, number>();
  for (const c of comments) if (c.createdSec !== null) counts.set(c.createdSec, (counts.get(c.createdSec) ?? 0) + 1);
  return comments
    .map((c, i) => ({ c, r: rank(c, i) }))
    .sort((a, b) => {
      // A comment whose time could not be read goes last, since nothing can be said about where it belongs.
      if (a.c.createdSec === null || b.c.createdSec === null) {
        if (a.c.createdSec === b.c.createdSec) return a.r - b.r;
        return a.c.createdSec === null ? 1 : -1;
      }
      return a.c.createdSec - b.c.createdSec || a.r - b.r;
    })
    .map(({ c }) => ({ ...c, sameSecond: c.createdSec === null ? 1 : counts.get(c.createdSec) ?? 1 }));
}

/** True when a Graph API error means the sign in is no longer good and the seller should connect again. */
export function isExpired(error: { code?: number; type?: string } | null | undefined): boolean {
  return !!error && (error.code === 190 || error.type === 'OAuthException');
}

/** A clock time for a Meta created time, down to the second, in the phone's own time zone. */
export function showMetaTime(sec: number | null, iso: string): string {
  if (sec === null) return iso || 'Time not given';
  return new Date(sec * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

export interface DemoLot {
  number: number;
  name: string;
  price: number;
}

/**
 * The demonstration sale. It says plainly that it is a demonstration, so no buyer is misled, and it
 * never carries a checkout form link.
 */
export const DEMO_SALE: { post: string; lots: DemoLot[] } = {
  post: [
    'Skrybix demonstration, Grower Showcase.',
    '',
    'This post was made by the Skrybix app to show how a sale runs on my Page. Nothing here is for sale. Each lot is listed in the comments below.',
  ].join('\n'),
  lots: [
    { number: 1, name: 'Hoya carnosa', price: 10 },
    { number: 2, name: 'Hoya kerrii', price: 12 },
    { number: 3, name: 'Hoya linearis', price: 15 },
  ],
};

/** The comment that lists one lot under the sale post. */
export const lotComment = (lot: DemoLot): string => `Lot ${lot.number}: ${lot.name}, $${lot.price}. Demonstration only.`;

/** How far the demonstration sale has got on a Page, kept so a failed run finishes instead of posting twice. */
export interface DemoProgress {
  postId: string;
  /** How many lot comments are already under the post. */
  commented: number;
}

export const demoDone = (p: DemoProgress | null | undefined): boolean => !!p && p.commented >= DEMO_SALE.lots.length;
