import { validateWithRevenueCat } from '../services/revenuecat.service';
import type { ReceiptClaim } from '../services/payments.service';

const ORIGINAL_FETCH = global.fetch;

const mockSubscriber = (subscriber: any) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ subscriber }),
    text: async () => '',
  }) as any;
};

const claim = (over: Partial<ReceiptClaim> = {}): ReceiptClaim => ({
  kind: 'token_pack',
  productId: 'tokens_15',
  receipt: 'rc',
  appUserId: '42',
  ...over,
});

describe('RevenueCat receipt validation', () => {
  beforeAll(() => {
    process.env.REVENUECAT_SECRET_KEY = 'test-secret';
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('accepts a token pack the store confirms this user bought', async () => {
    mockSubscriber({
      non_subscriptions: {
        tokens_15: [
          { id: 'old', purchase_date: '2026-01-01T00:00:00Z', store: 'app_store' },
          { store_transaction_id: 'txn_new', purchase_date: '2026-08-01T00:00:00Z', store: 'app_store' },
        ],
      },
    });

    const result = await validateWithRevenueCat(claim());

    // The newest purchase wins, and its store id is what makes granting idempotent.
    expect(result.transactionId).toBe('txn_new');
    expect(result.provider).toBe('apple');
    expect(result.amountCents).toBe(399);
  });

  it('rejects a token pack the user never bought', async () => {
    mockSubscriber({ non_subscriptions: {} });
    await expect(validateWithRevenueCat(claim())).rejects.toThrow('PURCHASE_NOT_FOUND');
  });

  it('rejects a product that is not in our catalogue', async () => {
    mockSubscriber({
      non_subscriptions: { tokens_9999: [{ id: 'x', purchase_date: '2026-08-01T00:00:00Z' }] },
    });
    // The store says it was bought, but we do not sell it, so nothing is granted.
    await expect(
      validateWithRevenueCat(claim({ productId: 'tokens_9999' }))
    ).rejects.toThrow('UNKNOWN_PRODUCT');
  });

  it('accepts an active subscription and carries its expiry', async () => {
    const future = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    mockSubscriber({
      subscriptions: {
        pro_1month: {
          expires_date: future,
          purchase_date: '2026-08-01T00:00:00Z',
          store: 'play_store',
          store_transaction_id: 'sub_txn_1',
        },
      },
    });

    const result = await validateWithRevenueCat(
      claim({ kind: 'subscription', productId: 'pro_1month' })
    );

    expect(result.transactionId).toBe('sub_txn_1');
    expect(result.provider).toBe('google');
    expect(result.expiresAt?.toISOString()).toBe(future);
  });

  it('rejects a subscription that has already lapsed', async () => {
    mockSubscriber({
      subscriptions: {
        pro_1month: {
          expires_date: '2026-01-01T00:00:00Z',
          purchase_date: '2025-12-01T00:00:00Z',
          store: 'app_store',
        },
      },
    });

    await expect(
      validateWithRevenueCat(claim({ kind: 'subscription', productId: 'pro_1month' }))
    ).rejects.toThrow('SUBSCRIPTION_NOT_ACTIVE');
  });

  it('surfaces a failed RevenueCat lookup instead of granting', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'not found',
    }) as any;

    await expect(validateWithRevenueCat(claim())).rejects.toThrow('REVENUECAT_LOOKUP_FAILED');
  });
});
