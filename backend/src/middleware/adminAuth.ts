import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import pool from '../config/database';

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};
