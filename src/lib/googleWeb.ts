// The computer version signs in inside a browser. On the phone there is nothing to do here.
export const webSignInReady = (): boolean => false;
export async function signInWeb(): Promise<string> {
  throw new Error('The computer version opens in a desktop browser.');
}
export async function webToken(): Promise<string> {
  throw new Error('The computer version opens in a desktop browser.');
}
export function signOutWeb(): void {}
