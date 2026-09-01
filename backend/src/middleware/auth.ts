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
      'SELECT is_banned, last_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (result.rows[0].is_banned) {
      return res.status(403).json({ error: 'This account has been suspended.' });
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
      // Deliberately not awaited: activity tracking must never add latency to,
      // or fail, the request it is observing.
      pool
        .query('UPDATE users SET last_active = NOW() WHERE id = $1', [decoded.userId])
        .catch((error: any) => console.warn('last_active update failed:', error?.message));
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
