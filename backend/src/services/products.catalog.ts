/**
 * Product catalogue.
 *
 * These identifiers must match the products created in App Store Connect and
 * Google Play Console exactly, and the offerings configured in RevenueCat.
 * Prices are the list prices in USD cents; what a user is actually charged
 * varies by storefront and currency, so the RevenueCat webhook corrects the
 * recorded amount when it reports the real figure.
 */

export type TokenPackProduct = {
  kind: 'token_pack';
  productId: string;
  packId: string;
  tokens: number;
  amountCents: number;
};

export type SubscriptionProduct = {
  kind: 'subscription';
  productId: string;
  plan: 'pro' | 'premium';
  duration: string;
  durationDays: number;
  amountCents: number;
};

export type CatalogProduct = TokenPackProduct | SubscriptionProduct;

// Prices mirror CheckoutScreen.tsx and SubscriptionScreen.tsx.
export const TOKEN_PACK_PRODUCTS: TokenPackProduct[] = [
  { kind: 'token_pack', productId: 'tokens_15', packId: '15', tokens: 15, amountCents: 399 },
  { kind: 'token_pack', productId: 'tokens_40', packId: '40', tokens: 40, amountCents: 899 },
  { kind: 'token_pack', productId: 'tokens_95', packId: '95', tokens: 95, amountCents: 1699 },
  { kind: 'token_pack', productId: 'tokens_260', packId: '260', tokens: 260, amountCents: 3999 },
];

export const SUBSCRIPTION_PRODUCTS: SubscriptionProduct[] = [
  { kind: 'subscription', productId: 'pro_1week', plan: 'pro', duration: '1week', durationDays: 7, amountCents: 699 },
  { kind: 'subscription', productId: 'pro_1month', plan: 'pro', duration: '1month', durationDays: 30, amountCents: 1499 },
  { kind: 'subscription', productId: 'pro_3month', plan: 'pro', duration: '3month', durationDays: 90, amountCents: 2999 },
  { kind: 'subscription', productId: 'pro_6month', plan: 'pro', duration: '6month', durationDays: 180, amountCents: 4499 },
  { kind: 'subscription', productId: 'premium_1week', plan: 'premium', duration: '1week', durationDays: 7, amountCents: 1199 },
  { kind: 'subscription', productId: 'premium_1month', plan: 'premium', duration: '1month', durationDays: 30, amountCents: 2499 },
  { kind: 'subscription', productId: 'premium_3month', plan: 'premium', duration: '3month', durationDays: 90, amountCents: 4999 },
  { kind: 'subscription', productId: 'premium_6month', plan: 'premium', duration: '6month', durationDays: 180, amountCents: 7499 },
];

const BY_ID = new Map<string, CatalogProduct>(
  [...TOKEN_PACK_PRODUCTS, ...SUBSCRIPTION_PRODUCTS].map((p) => [p.productId, p])
);

export const getProduct = (productId: string): CatalogProduct | undefined => BY_ID.get(productId);

export const getTokenPackByPackId = (packId: string): TokenPackProduct | undefined =>
  TOKEN_PACK_PRODUCTS.find((p) => p.packId === packId);

export const getSubscriptionProduct = (
  plan: string,
  duration: string
): SubscriptionProduct | undefined =>
  SUBSCRIPTION_PRODUCTS.find((p) => p.plan === plan && p.duration === duration);
