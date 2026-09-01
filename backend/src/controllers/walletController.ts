import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { ensureDailyAllowance } from '../services/credits.service';
import { WEEKLY_FREE_TOKENS } from '../utils/constants';
import {
  isPaymentsEnabled,
  validateReceipt,
  PAYMENTS_DISABLED_MESSAGE,
  type PurchaseKind,
} from '../services/payments.service';

// Price in integer cents, keyed by the number of tokens in the pack.
const TOKEN_PACKS: Record<string, number> = {
  '15': 399,
  '40': 899,
  '95': 1699,
  '260': 3999,
};

// Subscription plan durations, in days.
const SUBSCRIPTION_DURATIONS: Record<string, number> = {
  '1week': 7,
  '1month': 30,
  '3month': 90,
  '6month': 180,
};

export const getWalletSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Opening the wallet is the natural place to settle a pending allowance.
    const allowance = await ensureDailyAllowance(userId);

    const userResult = await pool.query(
      'SELECT credit_balance FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const txResult = await pool.query(
      `SELECT id, amount, direction, reason, metadata, created_at
       FROM credit_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [userId]
    );

    return res.json({
      credit_balance: Number(userResult.rows[0].credit_balance || 0),
      transactions: txResult.rows,
      payments_enabled: isPaymentsEnabled(),
      // Lets the client explain where tokens come from while packs are unavailable.
      free_allowance: WEEKLY_FREE_TOKENS,
      next_refill_at: allowance.next_refill_at,
    });
  } catch (error) {
    console.error('Get wallet summary error:', error);
    return res.status(500).json({ error: 'Failed to fetch wallet summary' });
  }
};

/**
 * Rejects the request unless payments are fully configured. Every endpoint that
 * grants paid goods calls this first. Returns true when the caller should stop.
 */
const blockIfPaymentsDisabled = (res: Response): boolean => {
  if (isPaymentsEnabled()) return false;
  res.status(501).json({
    error: PAYMENTS_DISABLED_MESSAGE,
    payments_enabled: false,
  });
  return true;
};

const readReceipt = (req: AuthRequest, kind: PurchaseKind, productId: string) => {
  const { receipt } = req.body as { receipt?: string };
  if (!receipt || typeof receipt !== 'string' || receipt.trim().length === 0) {
    return null;
  }
  // appUserId is taken from the JWT, never from the body, so a client cannot
  // claim someone else's purchase.
  return { kind, productId, receipt: receipt.trim(), appUserId: String(req.userId) };
};

export const purchasePlan = async (req: AuthRequest, res: Response) => {
  if (blockIfPaymentsDisabled(res)) return;

  const client = await pool.connect();
  try {
    const userId = req.userId!;
    const { pack_id } = req.body as { pack_id?: string };

    if (!pack_id || !TOKEN_PACKS[pack_id]) {
      return res.status(400).json({ error: 'Valid pack_id is required (15, 40, 95, or 260)' });
    }

    const claim = readReceipt(req, 'token_pack', `tokens_${pack_id}`);
    if (!claim) {
      return res.status(400).json({ error: 'A store receipt is required to complete a purchase.' });
    }

    // Throws unless the store confirms this exact purchase really happened.
    let validated;
    try {
      validated = await validateReceipt(claim);
    } catch (error: any) {
      console.error('Receipt validation failed:', error?.message);
      return res.status(402).json({ error: 'Could not verify your purchase with the store.' });
    }

    const tokenAmount = Number(pack_id);

    await client.query('BEGIN');

    // The store transaction id is UNIQUE, so a replayed receipt cannot double-credit.
    const existing = await client.query(
      'SELECT id FROM token_purchases WHERE provider_transaction_id = $1',
      [validated.transactionId]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      const current = await pool.query(
        'SELECT credit_balance, is_premium, premium_expires_at, boost_expires_at FROM users WHERE id = $1',
        [userId]
      );
      return res.json({
        message: 'Purchase already applied',
        wallet: current.rows[0],
        duplicate: true,
      });
    }

    await client.query(
      `INSERT INTO token_purchases
         (user_id, pack_id, tokens, amount_cents, currency, provider, provider_transaction_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        pack_id,
        tokenAmount,
        validated.amountCents,
        validated.currency,
        validated.provider,
        validated.transactionId,
      ]
    );

    await client.query(
      `UPDATE users
       SET credit_balance = credit_balance + $2::int, updated_at = NOW()
       WHERE id = $1`,
      [userId, tokenAmount]
    );

    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, direction, reason, metadata)
       VALUES ($1, $2, 'credit', 'token_pack_purchase', $3)`,
      [
        userId,
        tokenAmount,
        JSON.stringify({
          pack_id,
          amount_cents: validated.amountCents,
          provider: validated.provider,
          provider_transaction_id: validated.transactionId,
        }),
      ]
    );

    const result = await client.query(
      'SELECT credit_balance, is_premium, premium_expires_at, boost_expires_at FROM users WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');
    return res.json({
      message: 'Tokens added to your wallet.',
      wallet: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Purchase plan error:', error);
    return res.status(500).json({ error: 'Failed to apply purchase' });
  } finally {
    client.release();
  }
};

export const subscribe = async (req: AuthRequest, res: Response) => {
  if (blockIfPaymentsDisabled(res)) return;

  const client = await pool.connect();
  try {
    const userId = req.userId!;
    const { plan, duration } = req.body as { plan?: string; duration?: string };

    if (!plan || !['pro', 'premium'].includes(plan)) {
      return res.status(400).json({ error: "plan must be 'pro' or 'premium'" });
    }
    if (!duration || !SUBSCRIPTION_DURATIONS[duration]) {
      return res.status(400).json({ error: 'duration must be 1week, 1month, 3month, or 6month' });
    }

    const claim = readReceipt(req, 'subscription', `${plan}_${duration}`);
    if (!claim) {
      return res.status(400).json({ error: 'A store receipt is required to complete a purchase.' });
    }

    let validated;
    try {
      validated = await validateReceipt(claim);
    } catch (error: any) {
      console.error('Receipt validation failed:', error?.message);
      return res.status(402).json({ error: 'Could not verify your subscription with the store.' });
    }

    const durationDays = SUBSCRIPTION_DURATIONS[duration];
    const expiresAt = validated.expiresAt
      ? validated.expiresAt
      : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM subscriptions WHERE provider_transaction_id = $1',
      [validated.transactionId]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.json({ message: 'Subscription already applied', duplicate: true });
    }

    await client.query(
      `UPDATE subscriptions SET status = 'expired', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    const inserted = await client.query(
      `INSERT INTO subscriptions
         (user_id, plan, status, starts_at, expires_at, provider, provider_transaction_id)
       VALUES ($1, $2, 'active', NOW(), $3, $4, $5)
       RETURNING id, plan, status, starts_at, expires_at`,
      [userId, plan, expiresAt, validated.provider, validated.transactionId]
    );

    await client.query(
      `UPDATE users SET is_premium = TRUE, premium_expires_at = $2, updated_at = NOW()
       WHERE id = $1`,
      [userId, expiresAt]
    );

    await client.query('COMMIT');
    return res.json({
      message: `You're now on ${plan}.`,
      subscription: inserted.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Subscribe error:', error);
    return res.status(500).json({ error: 'Failed to apply subscription' });
  } finally {
    client.release();
  }
};
