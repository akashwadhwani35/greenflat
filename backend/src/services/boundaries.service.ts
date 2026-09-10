/**
 * My Boundaries — per-user caps on incoming actions, and the six-hour Explore
 * window that bounds "unlimited likes".
 *
 * Both are receiver-side or window-side gates that must be consulted *before*
 * anything is charged: a Green Flag that cannot be delivered must not cost the
 * sender their tokens. Every function here takes an optional client so it can
 * run inside the caller's transaction.
 */
import pool from '../config/database';

/** Same shape credits.service uses: the pool or a transaction's client. */
type Queryable = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
};

export type IncomingKind = 'like' | 'greenflag' | 'compliment';

const COLUMN: Record<IncomingKind, { limit: string; count: string }> = {
  like: { limit: 'limit_likes', count: 'likes_count' },
  greenflag: { limit: 'limit_greenflags', count: 'greenflags_count' },
  compliment: { limit: 'limit_compliments', count: 'compliments_count' },
};

/** Counts roll over on a rolling 24 hours, matching the daily like limits. */
const INCOMING_RESET_HOURS = 24;

/** How long an Explore window lasts for someone on an unlimited plan. */
export const EXPLORE_WINDOW_HOURS = 6;

/**
 * A window's cap is drawn fresh each time between these bounds. A fixed 40
 * would be spotted and quoted back as "the app stops you at 40"; a moving
 * number reads as the supply of profiles running out.
 */
export const EXPLORE_WINDOW_MIN = 35;
export const EXPLORE_WINDOW_MAX = 42;

const drawExploreCap = () =>
  EXPLORE_WINDOW_MIN + Math.floor(Math.random() * (EXPLORE_WINDOW_MAX - EXPLORE_WINDOW_MIN + 1));

type Row = {
  enabled: boolean;
  limit_likes: number;
  limit_greenflags: number;
  limit_compliments: number;
  likes_count: number;
  greenflags_count: number;
  compliments_count: number;
  last_reset_at: string;
};

const q = (client?: Queryable) => (client ? client : pool);

/**
 * The receiver's boundaries row, creating it on first use and clearing the
 * counters when the day has rolled over.
 */
export const getIncomingLimits = async (userId: number, client?: Queryable): Promise<Row> => {
  const db = q(client);
  let result = await db.query(
    'SELECT * FROM user_incoming_limits WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    // Gender decides the default: on for women, off for everyone else.
    await db.query(
      // Casts are explicit because an untyped placeholder in an INSERT..SELECT
      // is inferred as text, which the in-memory test database rejects.
      `INSERT INTO user_incoming_limits (user_id, enabled)
       SELECT $1::int, (gender = 'female') FROM users WHERE id = $1::int
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    result = await db.query('SELECT * FROM user_incoming_limits WHERE user_id = $1', [userId]);
  }

  const row = result.rows[0] as Row;
  const lastReset = new Date(row.last_reset_at);
  const hoursSince = (Date.now() - lastReset.getTime()) / (1000 * 60 * 60);
  if (hoursSince >= INCOMING_RESET_HOURS) {
    const reset = await db.query(
      `UPDATE user_incoming_limits
          SET likes_count = 0, greenflags_count = 0, compliments_count = 0,
              last_reset_at = NOW(), updated_at = NOW()
        WHERE user_id = $1
        RETURNING *`,
      [userId]
    );
    return reset.rows[0] as Row;
  }
  return row;
};

export type IncomingCapacity = {
  /** False when the action must not be delivered and must not be charged for. */
  allowed: boolean;
  remaining: number;
  limit: number;
  /** When the receiver's counters next clear. */
  availableAt: Date;
};

/**
 * Whether one more action of this kind can be delivered to this person today.
 * A disabled master toggle means no cap at all.
 */
export const checkIncomingCapacity = async (
  receiverId: number,
  kind: IncomingKind,
  client?: Queryable
): Promise<IncomingCapacity> => {
  const row = await getIncomingLimits(receiverId, client);
  const { limit: limitCol, count: countCol } = COLUMN[kind];
  const limit = Number((row as any)[limitCol]);
  const used = Number((row as any)[countCol]);
  const availableAt = new Date(new Date(row.last_reset_at).getTime() + INCOMING_RESET_HOURS * 3600 * 1000);

  if (!row.enabled) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, limit, availableAt };
  }
  return { allowed: used < limit, remaining: Math.max(0, limit - used), limit, availableAt };
};

/** Records one delivered action. Call only after the action really happened. */
export const consumeIncomingCapacity = async (
  receiverId: number,
  kind: IncomingKind,
  client?: Queryable
): Promise<void> => {
  const { count: countCol } = COLUMN[kind];
  await q(client).query(
    `UPDATE user_incoming_limits
        SET ${countCol} = ${countCol} + 1, updated_at = NOW()
      WHERE user_id = $1 AND enabled = TRUE`,
    [receiverId]
  );
};

export type ExploreWindow = {
  /** True once this window's cap is spent. */
  exhausted: boolean;
  used: number;
  cap: number;
  /** When the next window opens. */
  opensAt: Date;
};

/**
 * The Explore window for someone whose plan has no daily like cap.
 *
 * Starts a window on first use, rolls to a fresh one (and a fresh cap) once six
 * hours have passed. Callers on a metered plan never reach this: their daily
 * limits bind first.
 */
export const checkExploreWindow = async (
  userId: number,
  client?: Queryable
): Promise<ExploreWindow> => {
  const db = q(client);
  const result = await db.query(
    `SELECT explore_window_started_at, explore_window_likes, explore_window_cap
       FROM user_activity_limits WHERE user_id = $1`,
    [userId]
  );

  const row = result.rows[0];
  const startedAt = row?.explore_window_started_at ? new Date(row.explore_window_started_at) : null;
  const windowMs = EXPLORE_WINDOW_HOURS * 3600 * 1000;
  const expired = !startedAt || Date.now() - startedAt.getTime() >= windowMs;

  if (expired) {
    const cap = drawExploreCap();
    const fresh = await db.query(
      `UPDATE user_activity_limits
          SET explore_window_started_at = NOW(),
              explore_window_likes = 0,
              explore_window_cap = $2,
              explore_window_notified_at = NULL
        WHERE user_id = $1
        RETURNING explore_window_started_at`,
      [userId, cap]
    );
    const opened = fresh.rows[0]?.explore_window_started_at
      ? new Date(fresh.rows[0].explore_window_started_at)
      : new Date();
    return { exhausted: false, used: 0, cap, opensAt: new Date(opened.getTime() + windowMs) };
  }

  const cap = Number(row.explore_window_cap) || drawExploreCap();
  const used = Number(row.explore_window_likes) || 0;
  return {
    exhausted: used >= cap,
    used,
    cap,
    opensAt: new Date(startedAt.getTime() + windowMs),
  };
};

export const consumeExploreWindow = async (userId: number, client?: Queryable): Promise<void> => {
  await q(client).query(
    `UPDATE user_activity_limits
        SET explore_window_likes = explore_window_likes + 1
      WHERE user_id = $1`,
    [userId]
  );
};
