// Lets the home screen tell the title screen that the app underneath is up. A cold open starts a fresh
// process, so the clock starts when this module loads.
const bornAt = Date.now();
let readyAt: number | null = null;
const listeners = new Set<() => void>();

/** Called by the home screen once it has mounted. Only the first call counts. */
export function markAppReady(): void {
  if (readyAt !== null) return;
  readyAt = Date.now();
  listeners.forEach((l) => l());
}

/** Milliseconds from launch until the app was ready, or null while it is not. */
export const readyAfter = (): number | null => (readyAt === null ? null : readyAt - bornAt);
export const sinceLaunch = (): number => Date.now() - bornAt;
export function onAppReady(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The sale is brought back at most once per launch, so going back to Home afterwards stays on Home.
let resumed = false;
export const resumedThisLaunch = (): boolean => resumed;
export const markResumed = (): void => {
  resumed = true;
};
