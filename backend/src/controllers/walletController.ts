import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

const TOKEN_PACKS: Record<string, number> = {
  '15': 399,
  '40': 899,
  '95': 1699,
  '260': 3999,
};

export const getWalletSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

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
    });
  } catch (error) {
    console.error('Get wallet summary error:', error);
    return res.status(500).json({ error: 'Failed to fetch wallet summary' });
  }
};

export const purchasePlan = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = req.userId!;
    const { pack_id, idempotency_key } = req.body as { pack_id?: string; idempotency_key?: string };

    if (!pack_id || !TOKEN_PACKS[pack_id]) {
      return res.status(400).json({ error: 'Valid pack_id is required (15, 40, 95, or 260)' });
    }

    const tokenAmount = Number(pack_id);
    const priceCents = TOKEN_PACKS[pack_id];

    await client.query('BEGIN');

    // Idempotency check: reject duplicate purchases with same key
    if (idempotency_key) {
      const existing = await client.query(
        `SELECT id FROM credit_transactions
         WHERE user_id = $1 AND metadata->>'idempotency_key' = $2`,
        [userId, idempotency_key]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        const result = await pool.query(
          'SELECT credit_balance, is_premium, premium_expires_at, boost_expires_at FROM users WHERE id = $1',
          [userId]
        );
        return res.json({
          message: 'Purchase already applied',
          wallet: result.rows[0],
          duplicate: true,
        });
      }
    }

    await client.query(
      `UPDATE users
       SET credit_balance = credit_balance + $2, updated_at = NOW()
       WHERE id = $1`,
      [userId, tokenAmount]
    );

    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, direction, reason, metadata)
       VALUES ($1, $2, 'credit', 'token_pack_purchase', $3)`,
      [userId, tokenAmount, JSON.stringify({ source: 'checkout', pack_id, price_cents: priceCents, ...(idempotency_key ? { idempotency_key } : {}) })]
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
