/**
 * Pro in the store product. The only thing that unlocks the checkout chain in the base build is an
 * active Apple subscription to one of the two plans below. Everything here is plain logic with no
 * native code in it, so it is tested without a phone.
 *
 * The prices live on Apple's side and are shown from the store's own answer. The seven day free
 * trial is set on the annual plan in App Store Connect, and the app only ever says "free trial"
 * when the store reports one for the person looking.
 */

export const PRO_MONTHLY = 'com.gatheringmoss.sellercard.pro.monthly';
export const PRO_ANNUAL = 'com.gatheringmoss.sellercard.pro.annual';
export const PRO_SKUS = [PRO_ANNUAL, PRO_MONTHLY] as const;

/** What the app remembers about a paid subscription, so Pro stays on when the phone is offline. */
export interface Entitlement {
  /** When the current paid period ends, in milliseconds. */
  until: number;
}

/** The slice of the store's answer this app reads. */
export interface ActiveSub {
  productId: string;
  isActive: boolean;
  expirationDateIOS?: number | null;
}

/** True while the remembered period has not ended. */
export function isEntitled(e: Entitlement | null | undefined, now: number): boolean {
  return !!e && Number.isFinite(e.until) && e.until > now;
}

/** The latest period end across the active Pro subscriptions, or null when there is none. */
export function entitlementFrom(subs: ActiveSub[], now: number): Entitlement | null {
  let until = 0;
  for (const s of subs) {
    if (!s.isActive || !(PRO_SKUS as readonly string[]).includes(s.productId)) continue;
    // An active subscription with no date from the store counts for a day, then is asked about again.
    const end = typeof s.expirationDateIOS === 'number' && s.expirationDateIOS > 0 ? s.expirationDateIOS : now + 86_400_000;
    until = Math.max(until, end);
  }
  return until > now ? { until } : null;
}

/** The slice of a store product the paywall reads. */
export interface PlanProduct {
  id: string;
  displayPrice: string;
  introductoryPricePaymentModeIOS?: string | null;
  introductoryPriceNumberOfPeriodsIOS?: string | null;
  introductoryPriceSubscriptionPeriodIOS?: string | null;
}

const UNIT_WORDS: Record<string, string> = { day: 'day', week: 'week', month: 'month', year: 'year' };

/** "7 day" style length of a free trial from the store's own data, or null when there is no free trial. */
export function trialLength(p: PlanProduct, eligible: boolean): { count: number; unit: string } | null {
  if (!eligible || p.introductoryPricePaymentModeIOS !== 'free-trial') return null;
  const unit = UNIT_WORDS[String(p.introductoryPriceSubscriptionPeriodIOS ?? '').toLowerCase()];
  const count = Number(p.introductoryPriceNumberOfPeriodsIOS);
  if (!unit || !Number.isFinite(count) || count < 1) return null;
  // The store counts a week as one period of a week, which people read better as days.
  return unit === 'week' ? { count: count * 7, unit: 'day' } : { count, unit };
}

/** "7 days free" or null. */
export function trialBadge(p: PlanProduct, eligible: boolean): string | null {
  const t = trialLength(p, eligible);
  return t ? `${t.count} ${t.unit}${t.count === 1 ? '' : 's'} free` : null;
}

/** What the plan costs and when it renews, with the trial said first when there is one. */
export function planLine(p: PlanProduct, eligible: boolean): string {
  const per = p.id === PRO_ANNUAL ? 'year' : 'month';
  const t = trialLength(p, eligible);
  if (!t) return `${p.displayPrice} a ${per}`;
  return `${t.count} ${t.unit}${t.count === 1 ? '' : 's'} free, then ${p.displayPrice} a ${per}`;
}

/** Plans in the order the paywall shows them: annual first, then monthly. Anything else the store sends is dropped. */
export function orderPlans<T extends { id: string }>(products: T[]): T[] {
  return (PRO_SKUS as readonly string[]).map((id) => products.find((p) => p.id === id)).filter((p): p is T => !!p);
}

/** Whether this build can sell Pro at all: the store product on an iPhone or iPad. */
export function canSell(platform: string, phil: boolean): boolean {
  return !phil && platform === 'ios';
}

export const PAYWALL_TITLE = 'Skrybix Pro';

export const SUBSCRIPTION_TERMS = [
  'Payment is charged to your Apple Account at confirmation of purchase.',
  'The subscription renews automatically unless it is turned off at least 24 hours before the end of the current period.',
  'Your account is charged for renewal within 24 hours before the end of the current period.',
  'Manage or cancel any time in your Apple Account settings. A free trial you do not cancel in time turns into a paid subscription.',
] as const;

export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
