/**
 * Google sign in for the Drive backup, with no server of ours in it. The app signs the seller in
 * through the system browser with the standard code and PKCE flow, using a Google iOS client ID,
 * which is a public identifier and holds no secret. The ID comes from the build, so the Phil build
 * and the store build can each use the client made for their own bundle ID.
 */
import clients from './googleClients.json';

export const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
} as const;

export const GOOGLE_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';
export const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'];

/** The iOS client for a build: the one made for its own bundle ID, unless the build sets its own. */
export function iosClientFor(phil: boolean, fromEnv?: string): string {
  return fromEnv && fromEnv.endsWith('.apps.googleusercontent.com') ? fromEnv : phil ? clients.ios.phil : clients.ios.production;
}

/** The web client for the computer version, or null until one is made in the same Google Cloud project. */
export function webClient(fromEnv?: string): string | null {
  return fromEnv && fromEnv.endsWith('.apps.googleusercontent.com') ? fromEnv : (clients.web as string | null);
}

const SUFFIX = '.apps.googleusercontent.com';

/** True for something shaped like a Google iOS client ID. */
export function isClientId(id: string | undefined | null): id is string {
  return !!id && id.endsWith(SUFFIX) && id.length > SUFFIX.length + 3;
}

/** The URL scheme Google sends the seller back to: the client ID, reversed. */
export function redirectScheme(clientId: string): string {
  return `com.googleusercontent.apps.${clientId.slice(0, -SUFFIX.length)}`;
}

export function redirectUri(clientId: string): string {
  return `${redirectScheme(clientId)}:/oauthredirect`;
}
