import { Request, Response } from 'express';
import pool from '../config/database';
import { getProduct } from '../services/products.catalog';

/**
 * RevenueCat webhooks.
 *
 * Purchases are granted synchronously when the client calls /wallet/purchase or
 * /wallet/subscribe, but everything AFTER the first payment only reaches us here:
 * renewals, cancellations, expiries, billing failures and refunds. Without this
 * a subscription would never actually end.
 *
 * Auth is the shared secret configured in the RevenueCat dashboard, sent as the
 * Authorization header.
 */

const WEBHOOK_AUTH = process.env.REVENUECAT_WEBHOOK_AUTH || '';

type RCEvent = {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
  price?: number;
  currency?: string;
  store?: string;
  id?: string;
  transaction_id?: string;
  cancel_reason?: string;
};

const setPremium = async (userId: number, isPremium: boolean, expiresAt: Date | null) => {
  await pool.query(
    `UPDATE users SET is_premium = $2, premium_expires_at = $3, updated_at = NOW() WHERE id = $1`,
    [userId, isPremium, expiresAt]
  );
};

export const revenueCatWebhook = async (req: Request, res: Response) => {
  try {
    if (!WEBHOOK_AUTH) {
      console.warn('RevenueCat webhook hit but REVENUECAT_WEBHOOK_AUTH is not set');
      return res.status(503).json({ error: 'Webhook not configured' });
    }

    if (req.header('Authorization') !== WEBHOOK_AUTH) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const event = ((req.body as any)?.event || {}) as RCEvent;
    const userId = Number(event.app_user_id);

    if (!Number.isFinite(userId) || userId <= 0) {
      // Nothing actionable, but acknowledge so RevenueCat stops retrying.
      console.warn('RevenueCat webhook with unusable app_user_id:', event.app_user_id);
      return res.json({ received: true, ignored: 'bad app_user_id' });
    }

    const product = event.product_id ? getProduct(event.product_id) : undefined;
    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'PRODUCT_CHANGE': {
        if (!product || product.kind !== 'subscription') break;

        await pool.query(
          `UPDATE subscriptions SET status = 'expired', updated_at = NOW()
           WHERE user_id = $1 AND status = 'active'`,
          [userId]
        );

        await pool.query(
          `INSERT INTO subscriptions
             (user_id, plan, status, starts_at, expires_at, provider, provider_transaction_id)
           VALUES ($1, $2, 'active', NOW(), $3, $4, $5)
           ON CONFLICT (provider_transaction_id) DO UPDATE
             SET status = 'active', expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
          [
            userId,
            product.plan,
            expiresAt,
            event.store || 'revenuecat',
            event.transaction_id || event.id || `${userId}:${event.product_id}:${event.purchased_at_ms}`,
          ]
        );

        await setPremium(userId, true, expiresAt);
        break;
      }

      case 'CANCELLATION': {
        // The user turned off auto-renew. Access continues until it expires,
        // so only the intent is recorded here, not the access.
        await pool.query(
          `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
           WHERE user_id = $1 AND status = 'active'`,
          [userId]
        );
        break;
      }

      case 'EXPIRATION': {
        await pool.query(
          `UPDATE subscriptions SET status = 'expired', updated_at = NOW()
           WHERE user_id = $1 AND status IN ('active', 'cancelled')`,
          [userId]
        );
        await setPremium(userId, false, null);
        break;
      }

      case 'NON_RENEWING_PURCHASE': {
        // Token packs are granted by /wallet/purchase. The webhook is only used
        // to correct the recorded revenue to what the store actually charged.
        if (event.price && event.transaction_id) {
          await pool.query(
            `UPDATE token_purchases
             SET amount_cents = $2, currency = $3
             WHERE provider_transaction_id = $1`,
            [event.transaction_id, Math.round(Number(event.price) * 100), event.currency || 'USD']
          );
        }
        break;
      }

      default:
        // BILLING_ISSUE, SUBSCRIBER_ALIAS, TRANSFER, TEST and anything new.
        console.log('RevenueCat webhook, no action for type:', event.type);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('RevenueCat webhook error:', error);
    // 500 makes RevenueCat retry, which is what we want for a transient failure.
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};
