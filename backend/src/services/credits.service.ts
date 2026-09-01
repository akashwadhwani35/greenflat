import pool from '../config/database';
import { WEEKLY_FREE_TOKENS, TOKEN_ALLOWANCE_INTERVAL_HOURS } from '../utils/constants';

type Queryable = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
};

export type AllowanceResult = {
  credit_balance: number;
  granted: number;
  next_refill_at: string | null;
};

/**
 * Grants the weekly free tokens if they are due. Call this before reading a
 * balance or spending tokens.
 *
 * Additive: WEEKLY_FREE_TOKENS is added on top of whatever the user has, once
 * per interval. The row is locked for the check-and-grant so two concurrent
 * requests cannot both pay out.
 */
export const ensureDailyAllowance = async (userId: number): Promise<AllowanceResult> => {
  if (WEEKLY_FREE_TOKENS <= 0) {
    const current = await pool.query('SELECT credit_balance FROM users WHERE id = $1', [userId]);
    return {
      credit_balance: Number(current.rows[0]?.credit_balance || 0),
      granted: 0,
      next_refill_at: null,
    };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT credit_balance, last_token_refill_at, created_at FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('User not found');
    }

    const balance = Number(existing.rows[0].credit_balance || 0);
    // A brand new account's first weekly grant is a week after signup, not
    // immediately: the signup tokens are the first week's allowance.
    const lastRefillAt = existing.rows[0].last_token_refill_at || existing.rows[0].created_at;

    const intervalMs = TOKEN_ALLOWANCE_INTERVAL_HOURS * 60 * 60 * 1000;
    const dueForRefill = !lastRefillAt || Date.now() - new Date(lastRefillAt).getTime() >= intervalMs;

    if (!dueForRefill) {
      await client.query('COMMIT');
      return { credit_balance: balance, granted: 0, next_refill_at: nextRefillAt(lastRefillAt) };
    }

    const updated = await client.query(
      `UPDATE users
       SET credit_balance = credit_balance + $2::int,
           last_token_refill_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING credit_balance, last_token_refill_at`,
      [userId, WEEKLY_FREE_TOKENS]
    );

    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, direction, reason, metadata)
       VALUES ($1, $2, 'credit', 'weekly_allowance', $3)`,
      [userId, WEEKLY_FREE_TOKENS, JSON.stringify({ from: balance })]
    );

    await client.query('COMMIT');

    return {
      credit_balance: Number(updated.rows[0].credit_balance),
      granted: WEEKLY_FREE_TOKENS,
      next_refill_at: nextRefillAt(updated.rows[0].last_token_refill_at),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const nextRefillAt = (lastRefillAt: any): string | null => {
  if (!lastRefillAt) return null;
  const last = new Date(lastRefillAt).getTime();
  if (!Number.isFinite(last)) return null;
  return new Date(last + TOKEN_ALLOWANCE_INTERVAL_HOURS * 60 * 60 * 1000).toISOString();
};

export const getCreditBalance = async (userId: number): Promise<number> => {
  const result = await pool.query('SELECT credit_balance FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  return Number(result.rows[0].credit_balance || 0);
};

export const consumeCredits = async (
  userId: number,
  amount: number,
  reason: string,
  metadata: Record<string, any> = {},
  db?: Queryable
): Promise<number> => {
  const executor = db || pool;

  // The ::int casts are load-bearing: an untyped parameter in `column - $n` can be
  // evaluated with its operands reversed, silently producing a negative balance.
  const updateResult = await executor.query(
    `UPDATE users
     SET credit_balance = credit_balance - $1::int,
         updated_at = NOW()
     WHERE id = $2 AND credit_balance >= $1::int
     RETURNING credit_balance`,
    [amount, userId]
  );

  if (updateResult.rows.length === 0) {
    throw new Error('INSUFFICIENT_CREDITS');
  }

  await executor.query(
    `INSERT INTO credit_transactions (user_id, amount, direction, reason, metadata)
     VALUES ($1, $2, 'debit', $3, $4)`,
    [userId, amount, reason, JSON.stringify(metadata)]
  );

  return Number(updateResult.rows[0].credit_balance || 0);
};
