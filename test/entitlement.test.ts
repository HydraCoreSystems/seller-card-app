import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { announcementFor } from '../src/core/announce';
import {
  PAYWALL_TITLE,
  PRO_ANNUAL,
  PRO_MONTHLY,
  PRO_SKUS,
  SUBSCRIPTION_TERMS,
  canSell,
  entitlementFrom,
  isEntitled,
  orderPlans,
  planLine,
  trialBadge,
  trialLength,
} from '../src/core/entitlement';
import { PRO_POINTS, PRO_PRIVACY, PRO_TITLE } from '../src/core/pro';
import { DASH_PATTERN } from '../src/core/text';
import type { Profile, Sale } from '../src/core/types';
import { numberLots } from '../src/core/sale';

const keep = process.env.EXPO_PUBLIC_APP_VARIANT;
afterEach(() => {
  if (keep === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
  else process.env.EXPO_PUBLIC_APP_VARIANT = keep;
});

const NOW = Date.parse('2026-11-01T12:00:00Z');
const DAY = 86_400_000;

describe('the two subscription plans', () => {
  it('uses the product ids Apple was given', () => {
    expect(PRO_MONTHLY).toBe('com.gatheringmoss.sellercard.pro.monthly');
    expect(PRO_ANNUAL).toBe('com.gatheringmoss.sellercard.pro.annual');
    expect([...PRO_SKUS].sort()).toEqual([PRO_ANNUAL, PRO_MONTHLY].sort());
  });

  it('shows annual first and drops any product it does not know', () => {
    const got = orderPlans([{ id: PRO_MONTHLY }, { id: 'other' }, { id: PRO_ANNUAL }]);
    expect(got.map((p) => p.id)).toEqual([PRO_ANNUAL, PRO_MONTHLY]);
  });
});

describe('the entitlement check', () => {
  it('is on only while a paid period has not ended', () => {
    expect(isEntitled({ until: NOW + DAY }, NOW)).toBe(true);
    expect(isEntitled({ until: NOW - 1 }, NOW)).toBe(false);
    expect(isEntitled(null, NOW)).toBe(false);
    expect(isEntitled({ until: Number.NaN }, NOW)).toBe(false);
  });

  it('takes the latest end among active Pro plans', () => {
    const subs = [
      { productId: PRO_MONTHLY, isActive: true, expirationDateIOS: NOW + 5 * DAY },
      { productId: PRO_ANNUAL, isActive: true, expirationDateIOS: NOW + 300 * DAY },
    ];
    expect(entitlementFrom(subs, NOW)).toEqual({ until: NOW + 300 * DAY });
  });

  it('ignores inactive, expired and unknown subscriptions', () => {
    expect(entitlementFrom([{ productId: PRO_ANNUAL, isActive: false, expirationDateIOS: NOW + DAY }], NOW)).toBeNull();
    expect(entitlementFrom([{ productId: PRO_ANNUAL, isActive: true, expirationDateIOS: NOW - DAY }], NOW)).toBeNull();
    expect(entitlementFrom([{ productId: 'com.someone.else', isActive: true, expirationDateIOS: NOW + DAY }], NOW)).toBeNull();
    expect(entitlementFrom([], NOW)).toBeNull();
  });

  it('counts an active plan with no date for one day, then asks again', () => {
    expect(entitlementFrom([{ productId: PRO_MONTHLY, isActive: true }], NOW)).toEqual({ until: NOW + DAY });
  });

  it('sells only in the store product on an iPhone or iPad', () => {
    expect(canSell('ios', false)).toBe(true);
    expect(canSell('ios', true)).toBe(false);
    expect(canSell('android', false)).toBe(false);
    expect(canSell('web', false)).toBe(false);
  });
});

describe('the free trial wording', () => {
  const annual = {
    id: PRO_ANNUAL,
    displayPrice: '$29.99',
    introductoryPricePaymentModeIOS: 'free-trial',
    introductoryPriceNumberOfPeriodsIOS: '1',
    introductoryPriceSubscriptionPeriodIOS: 'week',
  };
  const monthly = { id: PRO_MONTHLY, displayPrice: '$4.99', introductoryPricePaymentModeIOS: 'empty' };

  it('says 7 days free only when the store reports a free trial and the person can still get it', () => {
    expect(trialLength(annual, true)).toEqual({ count: 7, unit: 'day' });
    expect(trialBadge(annual, true)).toBe('7 days free');
    expect(planLine(annual, true)).toBe('7 days free, then $29.99 a year');
  });

  it('promises no trial to someone who already used it, or when the store did not answer', () => {
    expect(trialLength(annual, false)).toBeNull();
    expect(planLine(annual, false)).toBe('$29.99 a year');
  });

  it('promises no trial on a plan the store did not give one', () => {
    expect(trialLength(monthly, true)).toBeNull();
    expect(planLine(monthly, true)).toBe('$4.99 a month');
  });

  it('reads a trial given in days as days', () => {
    expect(trialBadge({ ...annual, introductoryPriceNumberOfPeriodsIOS: '7', introductoryPriceSubscriptionPeriodIOS: 'day' }, true)).toBe('7 days free');
  });
});

describe('Pro in each build', () => {
  const profile = {
    sellerName: 'Fern', timeZone: 'Eastern', sellerNumber: '', defaultFormat: 'generic', shipping: '', shippingDays: [], payment: '', claimRules: '',
  } as unknown as Profile;
  const sale = {
    id: 's', kind: 'sale', formatId: 'generic', opens: null, closes: null, closeCall: '', claimRules: '', crossListing: '', createdAt: '2026-11-01',
    lots: numberLots([]), endsAt: { day: '2026-11-03', time: '20:00' }, contactHours: 24,
  } as unknown as Sale;

  it('keeps the base announcement exactly as it was while Pro is off', () => {
    delete process.env.EXPO_PUBLIC_APP_VARIANT;
    expect(announcementFor(profile, sale, false)).not.toContain('Message me within');
  });

  it('adds the buyer contact line in the base build once Pro is on', () => {
    delete process.env.EXPO_PUBLIC_APP_VARIANT;
    const text = announcementFor(profile, sale, true);
    expect(text).toContain('within');
    expect(text.length).toBeGreaterThan(announcementFor(profile, sale, false).length);
  });

  it('has no purchase code on the Phil path: the store module is not imported at load', () => {
    const iap = readFileSync('src/lib/iap.ts', 'utf8');
    expect(iap).not.toMatch(/^import .* from 'expo-iap'/m);
  });

  it('registers the paywall and the plugin', () => {
    expect(readFileSync('src/app/_layout.tsx', 'utf8')).toContain('name="paywall"');
    expect(JSON.parse(readFileSync('app.json', 'utf8')).expo.plugins).toContain('expo-iap');
  });

  it('keeps every word on the paywall free of dashes', () => {
    for (const text of [PAYWALL_TITLE, PRO_TITLE, PRO_PRIVACY, ...PRO_POINTS, ...SUBSCRIPTION_TERMS]) expect(DASH_PATTERN.test(text)).toBe(false);
    const screens = ['src/app/paywall.tsx', 'src/ui/ProExplainer.tsx'].map((f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')).join('\n');
    expect(screens).not.toMatch(/—|–|--/);
  });
});
