/**
 * The seller's Facebook sign in for the Page demonstration, through the system browser. Tokens stay
 * in this phone's secure storage. There is no app secret in the app and no server of ours.
 *
 * Facebook Login for Business signs in through a configuration, which carries the permissions, so
 * no scope is sent. Facebook returns the seller to a page on the shop, and that page opens the app's
 * own link with what Facebook sent. The state this app started the sign in with must come back.
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { META_APP_LINK, buildLoginUrl, checkReturn, parseReturn, type DemoProgress, type MetaPage, type PendingSignIn } from '../core/metaDemo';
import { exchangeCode, revokePermissions, unsubscribePage } from './metaGraph';

WebBrowser.maybeCompleteAuthSession();

const KEY = 'meta.session.v1';

export interface MetaSession {
  userToken: string;
  page: MetaPage | null;
  subscribed: boolean;
  /** The demonstration sale on the chosen Page, once the seller has started it. */
  demo?: DemoProgress;
}

export async function loadSession(): Promise<MetaSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as MetaSession;
    return s && typeof s.userToken === 'string' ? { userToken: s.userToken, page: s.page ?? null, subscribed: !!s.subscribed, demo: s.demo } : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: MetaSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
}

const PENDING_KEY = 'meta.pending.v1';

/** The sign in could not be trusted, so nothing was connected. */
export class SignInRefused extends Error {}

async function readPending(): Promise<PendingSignIn | null> {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_KEY);
    const p = raw ? (JSON.parse(raw) as PendingSignIn) : null;
    return p && typeof p.state === 'string' && typeof p.at === 'number' ? p : null;
  } catch {
    return null;
  }
}

async function finish(url: string): Promise<MetaSession | null> {
  const check = checkReturn(parseReturn(url), await readPending(), Date.now());
  // A link with no sign in waiting for it is an old one, so it is ignored. A wrong state is refused.
  if (check.kind === 'stale') return null;
  // Whatever it was, this sign in is used up now.
  await SecureStore.deleteItemAsync(PENDING_KEY).catch(() => undefined);
  if (check.kind === 'mismatch' || check.kind === 'empty') throw new SignInRefused(check.kind);
  if (check.kind === 'denied') return null;
  const token = check.kind === 'token' ? check.token : await exchangeCode(check.code);
  const session: MetaSession = { userToken: token, page: null, subscribed: false };
  await saveSession(session);
  return session;
}

// The shop page's hand off can reach the app by more than one road: the browser view watching for
// it, the phone's link handler, and the app's own route. All of them finish the same sign in once.
let last: { key: string; done: Promise<MetaSession | null> } | null = null;

/** Finishes a sign in from the link the shop page opened. Safe to call again with the same link. */
export function completeSignIn(url: string): Promise<MetaSession | null> {
  const key = parseReturn(url).state ?? url;
  if (last?.key === key) return last.done;
  const done = finish(url);
  last = { key, done };
  return done;
}

/**
 * Opens Facebook sign in. The seller returns through the shop page, which opens the app's own link.
 * Returns the new session, or null when the seller backed out, or when the link comes in some other
 * way a moment later, which the app's link handler then finishes.
 */
export async function signIn(): Promise<MetaSession | null> {
  const state = Crypto.randomUUID();
  const pending: PendingSignIn = { state, at: Date.now() };
  await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(pending));
  last = null;
  const result = await WebBrowser.openAuthSessionAsync(buildLoginUrl(state), META_APP_LINK);
  return result.type === 'success' ? completeSignIn(result.url) : null;
}

/**
 * Turns the Page's notices off, takes the permissions back and forgets the sign in on this phone.
 * The seller is always signed out. Returns false when Facebook could not confirm the notices are off.
 */
export async function disconnect(session: MetaSession | null): Promise<boolean> {
  let confirmed = true;
  if (session?.page && session.subscribed) {
    try {
      confirmed = await unsubscribePage(session.page);
    } catch {
      confirmed = false;
    }
  }
  if (session?.userToken) await revokePermissions(session.userToken).catch(() => undefined);
  await clearSession();
  return confirmed;
}
