/**
 * Google sign in for the computer version, with no server of ours in it. It uses Google's own sign in
 * library for browsers, which hands the page a short lived access token for the seller's own Drive.
 * The Web client ID is public. It has to belong to the same Google Cloud project as the iOS clients,
 * or this page cannot see the files the phone app made.
 */
import { DRIVE_SCOPE } from '../core/drive';
import { GOOGLE_USERINFO, webClient } from '../core/googleAuthConfig';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}
interface GoogleWindow {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient(config: {
          client_id: string;
          scope: string;
          callback: (r: TokenResponse) => void;
          error_callback?: (e: { type?: string }) => void;
        }): TokenClient;
        revoke(token: string, done?: () => void): void;
      };
    };
  };
}

const CLIENT_ID = webClient(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
const SCOPE = `openid email ${DRIVE_SCOPE}`;
const SRC = 'https://accounts.google.com/gsi/client';

export const webSignInReady = (): boolean => !!CLIENT_ID;

let script: Promise<void> | null = null;
function library(): Promise<void> {
  script ??= new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Could not load Google sign in. Check your connection.'));
    document.head.appendChild(el);
  });
  return script;
}

let current: { token: string; until: number } | null = null;
let client: TokenClient | null = null;
let waiting: { ok: (t: string) => void; fail: (e: Error) => void } | null = null;

async function ask(prompt: string): Promise<string> {
  await library();
  const g = (window as unknown as GoogleWindow).google;
  if (!g || !CLIENT_ID) throw new Error('Google sign in is not set up for this page yet.');
  client ??= g.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (r) => {
      if (r.access_token) {
        current = { token: r.access_token, until: Date.now() + (r.expires_in ?? 3000) * 1000 };
        waiting?.ok(r.access_token);
      } else waiting?.fail(new Error(r.error ? 'Google did not sign you in.' : 'Sign in was cancelled.'));
      waiting = null;
    },
    error_callback: () => {
      waiting?.fail(new Error('Sign in was cancelled.'));
      waiting = null;
    },
  });
  return new Promise<string>((ok, fail) => {
    waiting = { ok, fail };
    client!.requestAccessToken({ prompt });
  });
}

/** Opens Google's sign in window. Returns the account's email. */
export async function signInWeb(): Promise<string> {
  const token = await ask('select_account');
  const res = await fetch(GOOGLE_USERINFO, { headers: { Authorization: `Bearer ${token}` } });
  return ((await res.json()) as { email?: string }).email ?? 'your Google account';
}

/** A working token, asking Google again without a prompt once the last one is about to run out. */
export async function webToken(): Promise<string> {
  if (current && current.until - 60_000 > Date.now()) return current.token;
  return ask('');
}

export function signOutWeb(): void {
  const g = (window as unknown as GoogleWindow).google;
  if (current && g) g.accounts.oauth2.revoke(current.token);
  current = null;
}
