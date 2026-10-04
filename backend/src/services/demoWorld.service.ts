/**
 * Demo accounts live in a world of their own.
 *
 * They exist so walkthrough videos can be recorded in the real App Store build,
 * which means they share the production database with real people. Nothing a
 * demo account does may reach a real person, and no real person may ever be
 * shown one: a real user liking or messaging a profile with nobody behind it is
 * the deceptive-profile pattern dating apps have been prosecuted for.
 *
 * So the rule is symmetric. A viewer only ever sees, opens, likes, First-Moves
 * or saves accounts in the same world as themselves. Matches, chats and the
 * likes inbox need no rule of their own, because they can only be created
 * through those actions.
 */
import pool from '../config/database';

type Db = { query: (text: string, params?: any[]) => Promise<{ rows: any[] }> };

export const isDemoUser = async (userId: number | string, db: Db = pool): Promise<boolean> => {
  const result = await db.query('SELECT is_demo FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.is_demo === true;
};

/** False when either account is missing, so callers can treat it as "not found". */
export const sameWorld = async (
  a: number | string,
  b: number | string,
  db: Db = pool
): Promise<boolean> => {
  if (String(a) === String(b)) return true;
  const result = await db.query('SELECT id, is_demo FROM users WHERE id IN ($1, $2)', [a, b]);
  if (result.rows.length !== 2) return false;
  return (result.rows[0].is_demo === true) === (result.rows[1].is_demo === true);
};
