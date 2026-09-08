import { validateWithRevenueCat, resetRevenueCatCache } from '../services/revenuecat.service';
import type { ReceiptClaim } from '../services/payments.service';

const ORIGINAL_FETCH = global.fetch;

// v2 answers three lists: the project's products (RevenueCat id -> store id),
// then the customer's subscriptions and purchases, each keyed by RevenueCat
// product id. The mock routes on the URL the way the real API does.
const PRODUCTS = [
  { id: 'prod_t15', store_identifier: 'tokens_15' },
  { id: 'prod_t9999', store_identifier: 'tokens_9999' },
  { id: 'prod_p1m', store_identifier: 'pro_1month' },
];

const mockCustomer = (data: { subscriptions?: any[]; purchases?: any[] }) => {
  global.fetch = jest.fn().mockImplementation(async (url: string) => {
    const items = url.includes('/products')
      ? PRODUCTS
      : url.includes('/subscriptions')
      ? data.subscriptions || []
      : data.purchases || [];
    return { ok: true, json: async () => ({ items, next_page: null }), text: async () => '' };
  }) as any;
};

const claim = (over: Partial<ReceiptClaim> = {}): ReceiptClaim => ({
  kind: 'token_pack',
  productId: 'tokens_15',
  receipt: 'rc',
  appUserId: '42',
  ...over,
});

const day = 24 * 60 * 60 * 1000;

describe('RevenueCat receipt validation', () => {
  beforeAll(() => {
    process.env.REVENUECAT_SECRET_KEY = 'test-secret';
    process.env.REVENUECAT_PROJECT_ID = 'proj_test';
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    resetRevenueCatCache();
  });

  it('accepts a token pack the store confirms this user bought', async () => {
    mockCustomer({
      purchases: [
        { id: 'old', product_id: 'prod_t15', purchased_at: Date.now() - 200 * day, store: 'app_store', status: 'owned' },
        { id: 'new', product_id: 'prod_t15', purchased_at: Date.now() - day, store: 'app_store', status: 'owned', store_purchase_identifier: 'txn_new' },
      ],
    });

    const result = await validateWithRevenueCat(claim());

    // The newest purchase wins, and its store id is what makes granting idempotent.
    expect(result.transactionId).toBe('txn_new');
    expect(result.provider).toBe('apple');
    expect(result.amountCents).toBe(399);
  });

  it('rejects a token pack the user never bought', async () => {
    mockCustomer({ purchases: [] });
    await expect(validateWithRevenueCat(claim())).rejects.toThrow('PURCHASE_NOT_FOUND');
  });

  it('rejects a product that is not in our catalogue', async () => {
    mockCustomer({
      purchases: [{ id: 'x', product_id: 'prod_t9999', purchased_at: Date.now(), status: 'owned' }],
    });
    // The store says it was bought, but we do not sell it, so nothing is granted.
    await expect(
      validateWithRevenueCat(claim({ productId: 'tokens_9999' }))
    ).rejects.toThrow('UNKNOWN_PRODUCT');
  });

  it('accepts an active subscription and carries its expiry', async () => {
    const ends = Date.now() + 20 * day;
    mockCustomer({
      subscriptions: [
        {
          id: 'sub_1', product_id: 'prod_p1m', store: 'play_store', gives_access: true,
          current_period_starts_at: Date.now() - 10 * day, current_period_ends_at: ends,
          store_subscription_identifier: 'GPA.123',
        },
      ],
    });

    const result = await validateWithRevenueCat(claim({ kind: 'subscription', productId: 'pro_1month' }));

    expect(result.provider).toBe('google');
    expect(result.expiresAt?.getTime()).toBe(ends);
    expect(result.transactionId.startsWith('GPA.123:')).toBe(true);
  });

  it('rejects a subscription that has already lapsed', async () => {
    mockCustomer({
      subscriptions: [
        { id: 'sub_old', product_id: 'prod_p1m', gives_access: false, current_period_ends_at: Date.now() - day },
      ],
    });
    await expect(
      validateWithRevenueCat(claim({ kind: 'subscription', productId: 'pro_1month' }))
    ).rejects.toThrow('SUBSCRIPTION_NOT_ACTIVE');
  });

  it('surfaces a failed RevenueCat lookup instead of granting', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => 'bad key',
    }) as any;
    await expect(validateWithRevenueCat(claim())).rejects.toThrow('REVENUECAT_LOOKUP_FAILED');
  });
});
