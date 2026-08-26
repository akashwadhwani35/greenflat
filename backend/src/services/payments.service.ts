/**
 * Payments.
 *
 * There is no payment provider wired up yet. Until there is, every endpoint that
 * grants paid goods is closed: PAYMENTS_ENABLED must be explicitly set to 'true'
 * AND a receipt validator must be registered, or purchases return 501.
 *
 * This exists because /wallet/purchase previously credited tokens on nothing but
 * a request body, so any authenticated user could mint unlimited tokens.
 *
 * To go live you need BOTH:
 *   1. A validator registered via registerReceiptValidator() that verifies a
 *      receipt against Apple StoreKit / Google Play (directly or via RevenueCat).
 *      Mobile stores require their own billing for digital goods; Stripe is not
 *      an option for in-app token packs or subscriptions.
 *   2. PAYMENTS_ENABLED=true in the environment.
 */

export type PurchaseKind = 'token_pack' | 'subscription';

export type ReceiptClaim = {
  kind: PurchaseKind;
  /** Store product identifier, e.g. 'tokens_40' or 'pro_1month'. */
  productId: string;
  /** Raw receipt / purchase token from the client. */
  receipt: string;
  /**
   * Our user id, as a string. RevenueCat is keyed by app_user_id, so the
   * validator looks the purchase up against this rather than trusting the
   * client's own claim about what it bought.
   */
  appUserId: string;
};

export type ValidatedReceipt = {
  /** Provider-unique transaction id. Used to make granting idempotent. */
  transactionId: string;
  provider: 'apple' | 'google' | 'revenuecat';
  productId: string;
  /** Amount actually charged, in integer cents. */
  amountCents: number;
  currency: string;
  /** For subscriptions: when access should end. */
  expiresAt?: Date;
};

export type ReceiptValidator = (claim: ReceiptClaim) => Promise<ValidatedReceipt>;

let receiptValidator: ReceiptValidator | null = null;

export const registerReceiptValidator = (validator: ReceiptValidator) => {
  receiptValidator = validator;
};

/** Clears the registered validator, restoring the closed default. Used by tests. */
export const resetReceiptValidator = () => {
  receiptValidator = null;
};

export const hasReceiptValidator = () => receiptValidator !== null;

/**
 * Payments are only live when a validator exists AND the flag is on. Both are
 * required so that flipping the env var alone cannot reopen the free-token hole.
 */
export const isPaymentsEnabled = () =>
  process.env.PAYMENTS_ENABLED === 'true' && hasReceiptValidator();

export const PAYMENTS_DISABLED_MESSAGE =
  'Purchases are not available yet. In-app payments are not configured on this build.';

export const validateReceipt = async (claim: ReceiptClaim): Promise<ValidatedReceipt> => {
  if (!receiptValidator) {
    throw new Error('PAYMENTS_NOT_CONFIGURED');
  }
  return receiptValidator(claim);
};
