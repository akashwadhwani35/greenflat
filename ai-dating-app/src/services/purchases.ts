/**
 * RevenueCat client.
 *
 * The store charges the card and RevenueCat validates the receipt. The app then
 * tells our backend, which independently asks RevenueCat what this user owns
 * before granting anything. The client is never trusted about what it bought.
 *
 * Requires a native build. react-native-purchases does not exist in Expo Go, so
 * every entry point here degrades to "unavailable" rather than crashing.
 */
import { Platform } from 'react-native';
import {
  TOKEN_PACK_PRODUCT_IDS,
  subscriptionProductId,
  ALL_PRODUCT_IDS,
  type PackId,
  type PlanTier,
  type PlanDuration,
} from './productIds';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

let Purchases: any = null;
let configured = false;

/** Native module is absent in Expo Go and on web. */
const loadModule = (): any => {
  if (Purchases) return Purchases;
  try {
    // Required lazily so importing this file cannot crash a JS-only runtime.
    Purchases = require('react-native-purchases').default;
    return Purchases;
  } catch {
    return null;
  }
};

export const purchasesApiKey = () => (Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY);

export const isPurchasesAvailable = () => Boolean(loadModule()) && Boolean(purchasesApiKey());

/**
 * Identifies the user to RevenueCat with our own user id, which is what lets the
 * backend look their purchases up later. Safe to call repeatedly.
 */
export const configurePurchases = async (userId: number | null) => {
  const mod = loadModule();
  const apiKey = purchasesApiKey();
  if (!mod || !apiKey || userId == null) return false;

  try {
    if (!configured) {
      await mod.configure({ apiKey, appUserID: String(userId) });
      configured = true;
    } else {
      await mod.logIn(String(userId));
    }
    return true;
  } catch (error) {
    console.warn('RevenueCat configure failed:', error);
    return false;
  }
};

export const logOutPurchases = async () => {
  const mod = loadModule();
  if (!mod || !configured) return;
  try {
    await mod.logOut();
  } catch {
    // Best effort. Signing out of RevenueCat must not block app sign-out.
  }
};

export type PurchaseOutcome =
  | { status: 'success'; productId: string }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

const purchaseProduct = async (productId: string): Promise<PurchaseOutcome> => {
  const mod = loadModule();
  if (!mod || !purchasesApiKey()) return { status: 'unavailable' };

  try {
    const products = await mod.getProducts([productId]);
    const product = products.find((p: any) => p.identifier === productId) || products[0];
    if (!product) {
      return { status: 'error', message: 'This item is not available in your region yet.' };
    }

    await mod.purchaseStoreProduct(product);
    return { status: 'success', productId };
  } catch (error: any) {
    if (error?.userCancelled) return { status: 'cancelled' };
    return { status: 'error', message: error?.message || 'Purchase failed.' };
  }
};

export const purchaseTokenPack = (packId: PackId) =>
  purchaseProduct(TOKEN_PACK_PRODUCT_IDS[packId]);

export const purchaseSubscription = (plan: PlanTier, duration: PlanDuration) =>
  purchaseProduct(subscriptionProductId(plan, duration));

/**
 * Store prices, localised by the store. Falls back to the hardcoded list price
 * when the SDK is unavailable, so the paywall still renders something sensible.
 */
export const fetchLocalisedPrices = async (
  productIds: string[]
): Promise<Record<string, string>> => {
  const mod = loadModule();
  if (!mod || !purchasesApiKey()) return {};

  try {
    const products = await mod.getProducts(productIds);
    return products.reduce((acc: Record<string, string>, p: any) => {
      acc[p.identifier] = p.priceString;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

/** Our subscription product ids are `${plan}_${duration}`. */
const parseSubscriptionProductId = (productId: string): { plan: PlanTier; duration: PlanDuration } | null => {
  const match = /^(pro|premium)_(1week|1month|3month|6month)$/.exec(productId);
  if (!match) return null;
  return { plan: match[1] as PlanTier, duration: match[2] as PlanDuration };
};

export type ActiveSubscription = { plan: PlanTier; duration: PlanDuration; productId: string };

/**
 * What the store says this person currently holds. The server stays the source
 * of truth for is_premium (it re-checks with RevenueCat before granting), so
 * this is for restore flows and quick UI decisions, never for gating features.
 */
export const getActiveSubscription = async (): Promise<ActiveSubscription | null> => {
  const mod = loadModule();
  if (!mod || !purchasesApiKey() || !configured) return null;
  try {
    const info = await mod.getCustomerInfo();
    const active: string[] = Array.isArray(info?.activeSubscriptions) ? info.activeSubscriptions : [];
    // Store ids can carry a base-plan suffix on Android ("pro_1month:monthly").
    for (const raw of active) {
      const productId = String(raw).split(':')[0];
      if (!ALL_PRODUCT_IDS.includes(productId)) continue;
      const parsed = parseSubscriptionProductId(productId);
      if (parsed) return { ...parsed, productId };
    }
    return null;
  } catch {
    return null;
  }
};

/** Active entitlement ids as configured in the RevenueCat dashboard. */
export const getActiveEntitlements = async (): Promise<string[]> => {
  const mod = loadModule();
  if (!mod || !purchasesApiKey() || !configured) return [];
  try {
    const info = await mod.getCustomerInfo();
    return Object.keys(info?.entitlements?.active || {});
  } catch {
    return [];
  }
};

/**
 * Restore: asks the store for everything this Apple/Google account bought, then
 * reports the current subscription so the caller can re-claim it server-side.
 * Apple rejects apps whose paywall has no restore path.
 */
export const restorePurchases = async (): Promise<
  { status: 'restored'; subscription: ActiveSubscription | null } | { status: 'unavailable' } | { status: 'error'; message: string }
> => {
  const mod = loadModule();
  if (!mod || !purchasesApiKey() || !configured) return { status: 'unavailable' };
  try {
    await mod.restorePurchases();
    return { status: 'restored', subscription: await getActiveSubscription() };
  } catch (error: any) {
    return { status: 'error', message: error?.message || 'Could not restore purchases.' };
  }
};
