/**
 * RevenueCat receipt validation.
 *
 * The client buys through the RevenueCat SDK, which talks to StoreKit / Play
 * Billing and validates the receipt with the store. We never trust the client's
 * word for what it bought: we ask RevenueCat's REST API what THIS user actually
 * owns, keyed by app_user_id (which we set to our own numeric user id).
 *
 * Docs: https://www.revenuecat.com/docs/api-v1
 */
import {
  registerReceiptValidator,
  type ReceiptClaim,
  type ValidatedReceipt,
} from './payments.service';
import { getProduct } from './products.catalog';

// Read lazily rather than at module load, so configuration can change without a
// rebuild of the module graph and so tests can set it up before calling in.
const apiBase = () => process.env.REVENUECAT_API_BASE || 'https://api.revenuecat.com/v1';
const secretKey = () => process.env.REVENUECAT_SECRET_KEY || '';
// Sandbox purchases must not grant real goods in production.
const allowSandbox = () => process.env.REVENUECAT_ALLOW_SANDBOX === 'true';

export const isRevenueCatConfigured = () => Boolean(secretKey());

type RCSubscriber = {
  subscriptions?: Record<string, any>;
  non_subscriptions?: Record<string, any[]>;
  entitlements?: Record<string, any>;
};

const fetchSubscriber = async (appUserId: string): Promise<RCSubscriber> => {
  const response = await fetch(`${apiBase()}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`REVENUECAT_LOOKUP_FAILED (${response.status}): ${detail.slice(0, 200)}`);
  }

  const body = (await response.json()) as any;
  return (body?.subscriber || {}) as RCSubscriber;
};

const storeToProvider = (store: unknown): ValidatedReceipt['provider'] => {
  if (store === 'app_store' || store === 'mac_app_store') return 'apple';
  if (store === 'play_store') return 'google';
  return 'revenuecat';
};

const assertNotSandbox = (isSandbox: unknown) => {
  if (isSandbox && !allowSandbox() && process.env.NODE_ENV === 'production') {
    throw new Error('SANDBOX_PURCHASE_REJECTED');
  }
};

/**
 * A one-off purchase lands in non_subscriptions, keyed by product id, as a list
 * of every time that product was bought. We take the newest entry and use its
 * store transaction id, which is what makes granting idempotent: replaying the
 * same purchase resolves to the same id and the DB unique constraint rejects it.
 */
const validateTokenPack = async (
  claim: ReceiptClaim,
  subscriber: RCSubscriber
): Promise<ValidatedReceipt> => {
  const purchases = subscriber.non_subscriptions?.[claim.productId];

  if (!Array.isArray(purchases) || purchases.length === 0) {
    throw new Error('PURCHASE_NOT_FOUND');
  }

  const newest = [...purchases].sort((a, b) => {
    const at = new Date(a?.purchase_date || 0).getTime();
    const bt = new Date(b?.purchase_date || 0).getTime();
    return bt - at;
  })[0];

  assertNotSandbox(newest?.is_sandbox);

  const transactionId = newest?.store_transaction_id || newest?.id;
  if (!transactionId) {
    throw new Error('PURCHASE_MISSING_TRANSACTION_ID');
  }

  const product = getProduct(claim.productId);
  if (!product || product.kind !== 'token_pack') {
    throw new Error('UNKNOWN_PRODUCT');
  }

  return {
    transactionId: String(transactionId),
    provider: storeToProvider(newest?.store),
    productId: claim.productId,
    amountCents: Number(newest?.price_in_purchased_currency ? Math.round(Number(newest.price_in_purchased_currency) * 100) : product.amountCents),
    currency: newest?.currency || 'USD',
  };
};

/**
 * Subscriptions live under subscriptions[productId]. We require an expiry in the
 * future, so a lapsed or refunded subscription cannot be replayed for access.
 */
const validateSubscription = async (
  claim: ReceiptClaim,
  subscriber: RCSubscriber
): Promise<ValidatedReceipt> => {
  const sub = subscriber.subscriptions?.[claim.productId];
  if (!sub) {
    throw new Error('SUBSCRIPTION_NOT_FOUND');
  }

  assertNotSandbox(sub?.is_sandbox);

  const expiresAt = sub?.expires_date ? new Date(sub.expires_date) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new Error('SUBSCRIPTION_NOT_ACTIVE');
  }

  const product = getProduct(claim.productId);
  if (!product || product.kind !== 'subscription') {
    throw new Error('UNKNOWN_PRODUCT');
  }

  // Renewals reuse the product id, so the transaction id must include the period
  // to stay unique per billing cycle.
  const transactionId =
    sub?.store_transaction_id || `${claim.appUserId}:${claim.productId}:${sub.purchase_date}`;

  return {
    transactionId: String(transactionId),
    provider: storeToProvider(sub?.store),
    productId: claim.productId,
    amountCents: product.amountCents,
    currency: sub?.currency || 'USD',
    expiresAt,
  };
};

export const validateWithRevenueCat = async (claim: ReceiptClaim): Promise<ValidatedReceipt> => {
  if (!secretKey()) {
    throw new Error('PAYMENTS_NOT_CONFIGURED');
  }

  const subscriber = await fetchSubscriber(claim.appUserId);

  return claim.kind === 'token_pack'
    ? validateTokenPack(claim, subscriber)
    : validateSubscription(claim, subscriber);
};

/**
 * Registers the validator so isPaymentsEnabled() can become true. Without a
 * secret key nothing is registered and purchase endpoints keep returning 501.
 */
export const initRevenueCat = () => {
  if (!isRevenueCatConfigured()) return false;
  registerReceiptValidator(validateWithRevenueCat);
  return true;
};
