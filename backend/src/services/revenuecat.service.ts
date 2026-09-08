/**
 * RevenueCat receipt validation.
 *
 * The client buys through the RevenueCat SDK, which talks to StoreKit / Play
 * Billing and validates the receipt with the store. We never trust the client's
 * word for what it bought: we ask RevenueCat's REST API what THIS user actually
 * owns, keyed by app_user_id (which we set to our own numeric user id).
 *
 * Docs: https://www.revenuecat.com/docs/api-v2 (customers/{id}/subscriptions and /purchases)
 */
import {
  registerReceiptValidator,
  type ReceiptClaim,
  type ValidatedReceipt,
} from './payments.service';
import { getProduct } from './products.catalog';

// Read lazily rather than at module load, so configuration can change without a
// rebuild of the module graph and so tests can set it up before calling in.
//
// API v2: secret keys made in the dashboard today are v2-only (v1 answers
// "secret API key incompatible with RevenueCat API V1"). v2 needs the project
// id and reports products by RevenueCat id, so store identifiers are resolved
// through the project's product list (cached for an hour).
const apiBase = () => process.env.REVENUECAT_API_BASE || 'https://api.revenuecat.com/v2';
const secretKey = () => process.env.REVENUECAT_SECRET_KEY || '';
const projectId = () => process.env.REVENUECAT_PROJECT_ID || '';
// Sandbox purchases must not grant real goods in production.
const allowSandbox = () => process.env.REVENUECAT_ALLOW_SANDBOX === 'true';

export const isRevenueCatConfigured = () => Boolean(secretKey() && projectId());

type RCSubscription = {
  id: string;
  product_id: string;
  store?: string;
  environment?: string;
  status?: string;
  gives_access?: boolean;
  current_period_ends_at?: number;
  current_period_starts_at?: number;
  store_subscription_identifier?: string;
};

type RCPurchase = {
  id: string;
  product_id: string;
  store?: string;
  environment?: string;
  status?: string;
  purchased_at?: number;
  quantity?: number;
  store_purchase_identifier?: string;
  revenue_in_usd?: { gross?: number; commission?: number; tax?: number; proceeds?: number } | null;
};

type RCSubscriber = {
  subscriptions: RCSubscription[];
  purchases: RCPurchase[];
  /** RevenueCat product id -> store identifier (our catalogue id). */
  productIds: Record<string, string>;
};

const rcGet = async (path: string): Promise<any> => {
  const response = await fetch(`${apiBase()}${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
  });
  // A customer RevenueCat has never seen (the app's SDK creates them on first
  // launch) is simply someone who bought nothing, not a broken lookup.
  if (response.status === 404 && path.includes('/customers/')) {
    return { items: [], next_page: null };
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`REVENUECAT_LOOKUP_FAILED (${response.status}): ${detail.slice(0, 200)}`);
  }
  return response.json();
};

const listAll = async (path: string): Promise<any[]> => {
  const items: any[] = [];
  let next: string | null = `${path}${path.includes('?') ? '&' : '?'}limit=100`;
  // v2 pages with a next_page URL relative to the API host.
  for (let guard = 0; next && guard < 20; guard += 1) {
    const page = await rcGet(next.startsWith('http') ? next.replace(apiBase(), '') : next);
    items.push(...(Array.isArray(page?.items) ? page.items : []));
    next = typeof page?.next_page === 'string' && page.next_page ? page.next_page : null;
  }
  return items;
};

let productCache: { at: number; map: Record<string, string> } | null = null;
const PRODUCT_CACHE_MS = 60 * 60 * 1000;

const fetchProductMap = async (): Promise<Record<string, string>> => {
  if (productCache && Date.now() - productCache.at < PRODUCT_CACHE_MS) return productCache.map;
  const products = await listAll(`/projects/${projectId()}/products`);
  const map: Record<string, string> = {};
  for (const p of products) {
    if (p?.id && p?.store_identifier) map[String(p.id)] = String(p.store_identifier);
  }
  productCache = { at: Date.now(), map };
  return map;
};

/** Tests and configuration changes can drop the cached product list. */
export const resetRevenueCatCache = () => {
  productCache = null;
};

const fetchSubscriber = async (appUserId: string): Promise<RCSubscriber> => {
  const customer = encodeURIComponent(appUserId);
  const [productIds, subscriptions, purchases] = await Promise.all([
    fetchProductMap(),
    listAll(`/projects/${projectId()}/customers/${customer}/subscriptions`),
    listAll(`/projects/${projectId()}/customers/${customer}/purchases`),
  ]);
  return { productIds, subscriptions, purchases };
};

const storeToProvider = (store: unknown): ValidatedReceipt['provider'] => {
  if (store === 'app_store' || store === 'mac_app_store') return 'apple';
  if (store === 'play_store') return 'google';
  return 'revenuecat';
};

const assertNotSandbox = (environment: unknown) => {
  const isSandbox = environment === 'sandbox';
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
  const purchases = subscriber.purchases.filter(
    (p) => subscriber.productIds[p.product_id] === claim.productId && (p.status || 'owned') === 'owned'
  );

  if (purchases.length === 0) {
    throw new Error('PURCHASE_NOT_FOUND');
  }

  const newest = [...purchases].sort((a, b) => Number(b.purchased_at || 0) - Number(a.purchased_at || 0))[0];

  assertNotSandbox(newest.environment);

  const transactionId = newest.store_purchase_identifier || newest.id;
  if (!transactionId) {
    throw new Error('PURCHASE_MISSING_TRANSACTION_ID');
  }

  const product = getProduct(claim.productId);
  if (!product || product.kind !== 'token_pack') {
    throw new Error('UNKNOWN_PRODUCT');
  }

  const gross = Number(newest.revenue_in_usd?.gross);
  return {
    transactionId: String(transactionId),
    provider: storeToProvider(newest.store),
    productId: claim.productId,
    amountCents: Number.isFinite(gross) && gross > 0 ? Math.round(gross * 100) : product.amountCents,
    currency: 'USD',
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
  const matching = subscriber.subscriptions.filter(
    (sub) => subscriber.productIds[sub.product_id] === claim.productId
  );
  if (matching.length === 0) {
    throw new Error('SUBSCRIPTION_NOT_FOUND');
  }
  // The newest period wins; an old lapsed one must not hide a fresh purchase.
  const sub = [...matching].sort(
    (a, b) => Number(b.current_period_ends_at || 0) - Number(a.current_period_ends_at || 0)
  )[0];

  assertNotSandbox(sub.environment);

  const expiresAt = sub.current_period_ends_at ? new Date(Number(sub.current_period_ends_at)) : null;
  const active = sub.gives_access !== false && expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
  if (!active) {
    throw new Error('SUBSCRIPTION_NOT_ACTIVE');
  }

  const product = getProduct(claim.productId);
  if (!product || product.kind !== 'subscription') {
    throw new Error('UNKNOWN_PRODUCT');
  }

  // Renewals reuse the store id, so the period start keeps the id unique per
  // billing cycle and the DB constraint stops a replay of the same one.
  const transactionId = `${sub.store_subscription_identifier || sub.id}:${sub.current_period_starts_at || sub.current_period_ends_at}`;

  return {
    transactionId,
    provider: storeToProvider(sub.store),
    productId: claim.productId,
    amountCents: product.amountCents,
    currency: 'USD',
    expiresAt: expiresAt as Date,
  };
};

export const validateWithRevenueCat = async (claim: ReceiptClaim): Promise<ValidatedReceipt> => {
  if (!isRevenueCatConfigured()) {
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
