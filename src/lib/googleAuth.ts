/**
 * The seller's own Google sign in, through the system browser. Tokens stay on this phone: the
 * long lived refresh token in the phone's secure storage, the short lived access token in memory.
 * There is no server of ours in the middle and no copy anywhere else.
 */
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { DRIVE_SCOPE } from '../core/drive';
import { GOOGLE_DISCOVERY, GOOGLE_SCOPES, GOOGLE_USERINFO, iosClientFor, isClientId, redirectUri } from '../core/googleAuthConfig';
import { isPhil } from '../core/variant';
import { loadJson, saveJson } from './storage';

WebBrowser.maybeCompleteAuthSession();

const REFRESH_KEY = 'google.refresh';
const ACCOUNT_KEY = 'google.account.v1';
const CLIENT_ID = iosClientFor(isPhil(), process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

/** True when this build has a Google client and runs where the sign in works. */
export const googleReady = (): boolean => Platform.OS === 'ios' && isClientId(CLIENT_ID);

/** The Google account the seller connected, or null. */
export const connectedEmail = (): string | null => loadJson<{ email: string } | null>(ACCOUNT_KEY, null)?.email ?? null;

let cached: { token: string; until: number } | null = null;

/** Signs the seller in and keeps the refresh token. Returns the account's email, or null when they backed out. */
export async function connectGoogle(): Promise<string | null> {
  if (!googleReady() || !CLIENT_ID) throw new Error('Google is not set up in this build.');
  const redirect = redirectUri(CLIENT_ID);
  const request = new AuthSession.AuthRequest({
    clientId: CLIENT_ID,
    redirectUri: redirect,
    scopes: GOOGLE_SCOPES,
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
    // Offline access and a fresh consent screen, so Google hands back a refresh token.
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });
  await request.makeAuthUrlAsync(GOOGLE_DISCOVERY);
  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type !== 'success') return null;
  const tokens = await AuthSession.exchangeCodeAsync(
    { clientId: CLIENT_ID, code: result.params.code, redirectUri: redirect, extraParams: { code_verifier: request.codeVerifier ?? '' } },
    GOOGLE_DISCOVERY,
  );
  // Without the Drive permission ticked on the consent screen, a backup could not work. Say so.
  if (tokens.scope && !tokens.scope.split(' ').includes(DRIVE_SCOPE)) throw new Error('Skrybix needs permission to use its own Skrybix folder in your Drive.');
  if (!tokens.refreshToken) throw new Error('Google did not finish the sign in. Try again.');
  await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
  cached = { token: tokens.accessToken, until: Date.now() + (tokens.expiresIn ?? 3000) * 1000 };
  let email = '';
  try {
    const res = await fetch(GOOGLE_USERINFO, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    email = ((await res.json()) as { email?: string }).email ?? '';
  } catch {
    // The email is only for showing which account is connected.
  }
  saveJson(ACCOUNT_KEY, { email: email || 'your Google account' });
  return email || 'your Google account';
}

/** A working access token. Throws when the seller is not connected, or Google no longer accepts the sign in. */
export async function getAccessToken(): Promise<string> {
  if (cached && cached.until - 60_000 > Date.now()) return cached.token;
  if (!CLIENT_ID) throw new Error('Google is not set up in this build.');
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) throw new Error('Not connected to Google.');
  const fresh = await AuthSession.refreshAsync({ clientId: CLIENT_ID, refreshToken }, GOOGLE_DISCOVERY);
  cached = { token: fresh.accessToken, until: Date.now() + (fresh.expiresIn ?? 3000) * 1000 };
  return cached.token;
}

/** Forgets the sign in on this phone, and tells Google to stop honoring it. */
export async function disconnectGoogle(): Promise<void> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  cached = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => undefined);
  saveJson(ACCOUNT_KEY, null);
  if (refreshToken) {
    await fetch(`${GOOGLE_DISCOVERY.revocationEndpoint}?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' }).catch(() => undefined);
  }
}
