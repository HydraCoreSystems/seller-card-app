/**
 * Which build this is. One codebase makes two apps:
 *
 * closedTest  The version on Google Play for the closed test. It behaves exactly as it did before
 *             the checkout chain and the room work, and none of that is reachable in it.
 * phil        Phil's test version. The whole Pro checkout chain and every Part Two item are on and
 *             unlocked, with no gate, so he can live with them before any seller sees them.
 *
 * Set EXPO_PUBLIC_APP_VARIANT=phil at build time for the second one. Anything else, or nothing,
 * is the closed test build. This is read at the moment it's asked, so tests can switch it.
 *
 * The paywall belongs to the shipping product later. When it arrives it replaces the unlocked
 * Pro in the Phil build with a real check; nothing here decides that.
 */
export type Variant = 'closedTest' | 'phil';

export const variant = (): Variant => (process.env.EXPO_PUBLIC_APP_VARIANT === 'phil' ? 'phil' : 'closedTest');
export const isPhil = (): boolean => variant() === 'phil';
