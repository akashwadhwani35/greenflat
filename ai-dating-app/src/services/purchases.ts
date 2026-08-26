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
