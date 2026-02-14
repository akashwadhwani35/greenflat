import pool from '../config/database';

type Queryable = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
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

  const updateResult = await executor.query(
    `UPDATE users
     SET credit_balance = credit_balance - $1,
         updated_at = NOW()
     WHERE id = $2 AND credit_balance >= $1
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
