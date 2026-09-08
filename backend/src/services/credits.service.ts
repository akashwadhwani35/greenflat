import pool from '../config/database';
import { WEEKLY_FREE_TOKENS, TOKEN_ALLOWANCE_INTERVAL_HOURS } from '../utils/constants';

type Queryable = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
};

export type AllowanceResult = {
  credit_balance: number;
  granted: number;
  next_refill_at: string | null;
  /** Unspent weekly free tokens and when they lapse. Bought tokens never expire. */
  weekly_tokens_balance: number;
  weekly_tokens_expire_at: string | null;
  expired: number;
};

const WEEKLY_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Drops whatever is left of a weekly grant once its week is over. Runs inside
 * the caller's row lock. Bought tokens are untouched: the weekly counter never
 * exceeds the grant, and spending draws it down first.
 */
const expireWeeklyTokens = async (client: Queryable, userId: number, row: any): Promise<number> => {
  const remaining = Number(row.weekly_tokens_balance || 0);
  const expiresAt = row.weekly_tokens_expire_at ? new Date(row.weekly_tokens_expire_at).getTime() : null;
  if (remaining <= 0 || !expiresAt || expiresAt > Date.now()) return 0;
  const balance = Number(row.credit_balance || 0);
  const toRemove = Math.min(remaining, balance);
  await client.query(
    `UPDATE users
        SET credit_balance = credit_balance - $2::int,
            weekly_tokens_balance = 0,
            weekly_tokens_expire_at = NULL,
            updated_at = NOW()
      WHERE id = $1`,
    [userId, toRemove]
  );
  if (toRemove > 0) {
    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, direction, reason, metadata)
       VALUES ($1, $2, 'debit', 'weekly_expired', $3)`,
      [userId, toRemove, JSON.stringify({ expired_at: new Date(expiresAt).toISOString() })]
    );
  }
  return toRemove;
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
      weekly_tokens_balance: 0,
      weekly_tokens_expire_at: null,
      expired: 0,
    };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT credit_balance, last_token_refill_at, created_at, weekly_tokens_balance, weekly_tokens_expire_at FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('User not found');
    }

    // Last week's leftovers lapse before anything else is counted.
    const expired = await expireWeeklyTokens(client, userId, existing.rows[0]);
    const weeklyLeft = expired > 0 ? 0 : Number(existing.rows[0].weekly_tokens_balance || 0);
    const weeklyExpiresAt = expired > 0 ? null : existing.rows[0].weekly_tokens_expire_at;
    const balance = Number(existing.rows[0].credit_balance || 0) - expired;
    // A brand new account's first weekly grant is a week after signup, not
    // immediately: the signup tokens are the first week's allowance.
    const lastRefillAt = existing.rows[0].last_token_refill_at || existing.rows[0].created_at;

    const intervalMs = TOKEN_ALLOWANCE_INTERVAL_HOURS * 60 * 60 * 1000;
    const dueForRefill = !lastRefillAt || Date.now() - new Date(lastRefillAt).getTime() >= intervalMs;

    if (!dueForRefill) {
      await client.query('COMMIT');
      return {
        credit_balance: balance,
        granted: 0,
        next_refill_at: nextRefillAt(lastRefillAt),
        weekly_tokens_balance: weeklyLeft,
        weekly_tokens_expire_at: weeklyExpiresAt ? new Date(weeklyExpiresAt).toISOString() : null,
        expired,
      };
    }

    // A fresh grant replaces any unspent weekly tokens rather than stacking on
    // them: the free five are use-it-or-lose-it.
    const stale = weeklyLeft;
    const expiresAt = new Date(Date.now() + WEEKLY_TOKEN_TTL_MS);
    const updated = await client.query(
      `UPDATE users
       SET credit_balance = credit_balance - $3::int + $2::int,
           weekly_tokens_balance = $2::int,
           weekly_tokens_expire_at = $4,
           last_token_refill_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING credit_balance, last_token_refill_at`,
      [userId, WEEKLY_FREE_TOKENS, stale, expiresAt]
    );
    if (stale > 0) {
      await client.query(
        `INSERT INTO credit_transactions (user_id, amount, direction, reason, metadata)
         VALUES ($1, $2, 'debit', 'weekly_expired', $3)`,
        [userId, stale, JSON.stringify({ replaced_by_new_grant: true })]
      );
    }

    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, direction, reason, metadata)
       VALUES ($1, $2, 'credit', 'weekly_allowance', $3)`,
      [userId, WEEKLY_FREE_TOKENS, JSON.stringify({ from: balance, expires_at: expiresAt.toISOString() })]
    );

    await client.query('COMMIT');

    return {
      credit_balance: Number(updated.rows[0].credit_balance),
      granted: WEEKLY_FREE_TOKENS,
      next_refill_at: nextRefillAt(updated.rows[0].last_token_refill_at),
      weekly_tokens_balance: WEEKLY_FREE_TOKENS,
      weekly_tokens_expire_at: expiresAt.toISOString(),
      expired: expired + stale,
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
         weekly_tokens_balance = GREATEST(0, weekly_tokens_balance - $1::int),
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

/**
 * Gives tokens back after a charged action failed to deliver (e.g. an AI search
 * that errored after the token was taken). Ledgered as a credit so the wallet
 * history shows both sides.
 */
export const refundCredits = async (
  userId: number,
  amount: number,
  reason: string,
  metadata: Record<string, unknown> = {}
): Promise<number> => {
  const result = await pool.query(
    `UPDATE users SET credit_balance = credit_balance + $1::int, updated_at = NOW()
     WHERE id = $2 RETURNING credit_balance`,
    [amount, userId]
  );
  await pool.query(
    `INSERT INTO credit_transactions (user_id, amount, direction, reason, metadata)
     VALUES ($1, $2, 'credit', $3, $4)`,
    [userId, amount, reason, JSON.stringify(metadata)]
  );
  return result.rows[0]?.credit_balance ?? 0;
};
