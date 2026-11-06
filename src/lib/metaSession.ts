/**
 * The seller's Facebook sign in for the Page demonstration, through the system browser. Tokens stay
 * in this phone's secure storage. There is no app secret in the app and no server of ours.
 *
 * Facebook Login for Business signs in through a configuration, which carries the permissions, so
 * no scope is sent. The sign in returns a user access token to the app's own return address.
 */
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { LOGIN_DIALOG, META_APP_ID, META_CONFIG_ID, META_REDIRECT_URI, type DemoProgress, type MetaPage } from '../core/metaDemo';
import { revokePermissions, unsubscribePage } from './metaGraph';

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

/** Opens Facebook sign in. Returns the new session, or null when the seller backed out. */
export async function signIn(): Promise<MetaSession | null> {
  const discovery = { authorizationEndpoint: LOGIN_DIALOG };
  const request = new AuthSession.AuthRequest({
    clientId: META_APP_ID,
    redirectUri: META_REDIRECT_URI,
    responseType: AuthSession.ResponseType.Token,
    usePKCE: false,
    extraParams: { config_id: META_CONFIG_ID },
  });
  await request.makeAuthUrlAsync(discovery);
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success') return null;
  const token = result.params.access_token;
  if (!token) return null;
  const session: MetaSession = { userToken: token, page: null, subscribed: false };
  await saveSession(session);
  return session;
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
