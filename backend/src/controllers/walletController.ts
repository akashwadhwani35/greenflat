import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

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
    const { plan, idempotency_key } = req.body as { plan?: 'starter' | 'premium' | 'boost'; idempotency_key?: string };

    if (!plan) {
      return res.status(400).json({ error: 'plan is required' });
    }

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

    if (plan === 'starter') {
      await client.query(
        `UPDATE users
         SET credit_balance = credit_balance + 10, updated_at = NOW()
         WHERE id = $1`,
        [userId]
      );
      await client.query(
        `INSERT INTO credit_transactions (user_id, amount, direction, reason, metadata)
         VALUES ($1, $2, 'credit', 'starter_purchase', $3)`,
        [userId, 10, JSON.stringify({ source: 'checkout', ...(idempotency_key ? { idempotency_key } : {}) })]
      );
    } else if (plan === 'premium') {
      await client.query(
        `UPDATE users
         SET is_premium = TRUE,
             premium_expires_at = NOW() + INTERVAL '30 days',
             credit_balance = credit_balance + 30,
             updated_at = NOW()
         WHERE id = $1`,
        [userId]
      );
      await client.query(
        `INSERT INTO credit_transactions (user_id, amount, direction, reason, metadata)
         VALUES ($1, $2, 'credit', 'premium_purchase', $3)`,
        [userId, 30, JSON.stringify({ source: 'checkout', premium_days: 30, ...(idempotency_key ? { idempotency_key } : {}) })]
      );
    } else if (plan === 'boost') {
      await client.query(
        `UPDATE users
         SET boost_expires_at = NOW() + INTERVAL '24 hours',
             updated_at = NOW()
         WHERE id = $1`,
        [userId]
      );
    }

    const result = await client.query(
      'SELECT credit_balance, is_premium, premium_expires_at, boost_expires_at FROM users WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');
    return res.json({
      message: 'Purchase applied successfully',
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
