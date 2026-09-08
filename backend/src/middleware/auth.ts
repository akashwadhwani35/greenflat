import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../utils/constants';
import pool from '../config/database';

/** How stale last_active may get before we write it again. */
const ACTIVITY_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface AuthRequest extends Request {
  userId?: number;
  user?: any;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_CONFIG.secret) as { userId: number };

    // Tokens live for 7 days, so a ban has to be enforced per request. Checking
    // only at login left a banned user with up to a week of continued access.
    const result = await pool.query(
      'SELECT is_banned, last_active, is_premium, premium_expires_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (result.rows[0].is_banned) {
      return res.status(403).json({ error: 'This account has been suspended.' });
    }

    // A plan whose paid period has ended drops back to free right here, so
    // every quota and feature check downstream already sees a free account.
    // The app re-claims from the store on launch if the subscription renewed.
    const expiresAt = result.rows[0].premium_expires_at ? new Date(result.rows[0].premium_expires_at).getTime() : null;
    if (result.rows[0].is_premium && expiresAt !== null && expiresAt <= Date.now()) {
      await pool.query(
        `UPDATE users SET is_premium = FALSE, updated_at = NOW()
          WHERE id = $1 AND is_premium = TRUE AND premium_expires_at IS NOT NULL AND premium_expires_at <= NOW()`,
        [decoded.userId]
      );
      await pool.query(
        `UPDATE subscriptions SET status = 'expired', updated_at = NOW()
          WHERE user_id = $1 AND status = 'active' AND expires_at IS NOT NULL AND expires_at <= NOW()`,
        [decoded.userId]
      ).catch(() => {});
    }

    req.userId = decoded.userId;

    // Record activity, but at most once every few minutes per user. The admin
    // dashboard's DAU and MAU read this column; writing it on every request
    // would mean an extra UPDATE on every authenticated call for a number that
    // only needs day-level accuracy.
    const lastActive = result.rows[0].last_active
      ? new Date(result.rows[0].last_active).getTime()
      : 0;
    if (Date.now() - lastActive > ACTIVITY_TOUCH_INTERVAL_MS) {
      // Awaited, but never allowed to fail the request. It is a single indexed
      // UPDATE at most once per five minutes per user; letting it run detached
      // raced later transactions on the same row.
      try {
        await pool.query('UPDATE users SET last_active = NOW() WHERE id = $1', [decoded.userId]);
      } catch (error: any) {
        console.warn('last_active update failed:', error?.message);
      }
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
