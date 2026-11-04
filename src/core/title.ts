/** How long the title screen holds, in milliseconds. About two seconds, and never past three. */
export const TITLE_HOLD_MS = 2000;
export const TITLE_CAP_MS = 3000;
/** The short fade out into the app. */
export const TITLE_FADE_MS = 300;

/**
 * When the title screen should start leaving, counted from when it appeared. It holds for the full hold
 * time. If the app underneath is not ready by then, it waits for it, but never past the cap.
 * `readyAt` is how long after the title appeared the app became ready, or null while it is not ready yet.
 */
export function titleLiftAt(readyAt: number | null): number {
  const wanted = readyAt === null ? TITLE_CAP_MS : Math.max(TITLE_HOLD_MS, readyAt);
  return Math.min(wanted, TITLE_CAP_MS);
}
