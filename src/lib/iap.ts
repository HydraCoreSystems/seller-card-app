/**
 * Apple in app purchase, through expo-iap. This is the only file that touches it.
 *
 * It loads the library only when a purchase is needed, on an iPhone or iPad, in the store product.
 * The Phil build, Android and the web never load it, so nothing here can break them. If the store
 * cannot be reached, Pro simply stays as it was and the paywall says so.
 */
import { AppState, Platform } from 'react-native';
import {
  PRO_SKUS,
  canSell,
  entitlementFrom,
  isEntitled,
  orderPlans,
  type ActiveSub,
  type Entitlement,
  type PlanProduct,
} from '../core/entitlement';
import { isPhil } from '../core/variant';
import { loadJson, saveJson } from './storage';

type Iap = typeof import('expo-iap');
let loaded: Iap | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const iap = (): Iap => (loaded ??= require('expo-iap') as Iap);

const CACHE_KEY = 'entitlement.v1';

/** True when this build can sell Pro on this device. */
export const iapAvailable = (): boolean => canSell(Platform.OS, isPhil());

/** What was last confirmed paid, so Pro stays on with no signal. Only ever read in the store product. */
export function cachedPro(now = Date.now()): boolean {
  if (!iapAvailable()) return false;
  return isEntitled(loadJson<Entitlement | null>(CACHE_KEY, null), now);
}

function remember(e: Entitlement | null): void {
  try {
    saveJson(CACHE_KEY, e);
  } catch {
    // Nothing to do. The store is asked again next time.
  }
}

/** Asks the store what is active. Returns null when there is none, and throws when the store can't be reached. */
async function ask(): Promise<Entitlement | null> {
  const subs = (await iap().getActiveSubscriptions([...PRO_SKUS])) as ActiveSub[];
  const e = entitlementFrom(subs, Date.now());
  remember(e);
  return e;
}

/**
 * Opens the store connection, keeps Pro in step with it, and returns a function that closes it.
 * `onChange` gets true or false each time the store gives a clear answer, and nothing when it can't be reached.
 */
export function startIap(onChange: (pro: boolean) => void): () => void {
  if (!iapAvailable()) return () => undefined;
  let live = true;
  const sync = () =>
    ask()
      .then((e) => live && onChange(!!e))
      .catch(() => undefined);

  const updated = iap().purchaseUpdatedListener((purchase) => {
    // A purchase only counts once it is finished. Finishing it is how the store knows it was delivered.
    iap()
      .finishTransaction({ purchase, isConsumable: false })
      .catch(() => undefined)
      .then(sync);
  });
  const failed = iap().purchaseErrorListener(() => undefined);
  const awake = AppState.addEventListener('change', (s) => {
    if (s === 'active') sync();
  });

  iap()
    .initConnection()
    .then(sync)
    .catch(() => undefined);

  return () => {
    live = false;
    updated.remove();
    failed.remove();
    awake.remove();
    iap().endConnection().catch(() => undefined);
  };
}

export interface Plans {
  products: (PlanProduct & { title: string })[];
  /** Whether this person can still get the free trial. Only the store knows. */
  eligible: boolean;
}

/** The two plans with the store's own prices. Throws when the store can't be reached. */
export async function loadPlans(): Promise<Plans> {
  const lib = iap();
  await lib.initConnection();
  const found = ((await lib.fetchProducts({ skus: [...PRO_SKUS], type: 'subs' })) ?? []) as (PlanProduct & {
    title: string;
    subscriptionGroupIdIOS?: string | null;
  })[];
  const products = orderPlans(found);
  // The trial is offered once per subscription group. Without a clear yes from the store, no trial is promised.
  let eligible = false;
  const group = products.find((p) => p.subscriptionGroupIdIOS)?.subscriptionGroupIdIOS;
  if (group) {
    try {
      eligible = await lib.isEligibleForIntroOfferIOS(group);
    } catch {
      eligible = false;
    }
  }
  return { products, eligible };
}

/** Starts a purchase. The answer arrives through the purchase listener started by startIap. */
export async function buy(sku: string): Promise<void> {
  await iap().requestPurchase({ request: { apple: { sku } }, type: 'subs' });
}

/** Asks Apple to bring back earlier purchases, then checks. True when Pro is now on. */
export async function restore(): Promise<boolean> {
  await iap().restorePurchases();
  return !!(await ask());
}

/** Opens Apple's page for managing or cancelling. */
export async function manage(): Promise<void> {
  await iap().deepLinkToSubscriptions({});
}
