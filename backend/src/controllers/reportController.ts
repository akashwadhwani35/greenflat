import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { applyBlock, announceBlock } from './privacyController';

export const createReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { match_id, reason, target_user_id, details } = req.body as {
      match_id?: number; reason?: string; target_user_id?: number; details?: string;
    };

    if (!reason || reason.trim().length === 0 || (!match_id && !target_user_id)) {
      return res.status(400).json({ error: 'A reason and either match_id or target_user_id are required' });
    }

    let reportedId: number;
    if (match_id) {
      const matchResult = await pool.query(
        'SELECT user1_id, user2_id FROM matches WHERE id = $1',
        [match_id]
      );
      if (matchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Match not found' });
      }
      const match = matchResult.rows[0];
      if (match.user1_id !== userId && match.user2_id !== userId) {
        return res.status(403).json({ error: 'You are not part of this match' });
      }
      reportedId = match.user1_id === userId ? match.user2_id : match.user1_id;
    } else {
      reportedId = Number(target_user_id);
      if (!Number.isInteger(reportedId) || reportedId === userId) {
        return res.status(400).json({ error: 'Invalid target_user_id' });
      }
      const exists = await pool.query('SELECT 1 FROM users WHERE id = $1', [reportedId]);
      if (exists.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
    }
    const fullReason = details && details.trim() ? `${reason.trim()}: ${details.trim()}` : reason.trim();

    // Board 31: reporting someone also removes them from Explore, AI Match,
    // Likes, searches and chat, now and in future, the same way a block does.
    const client = await pool.connect();
    let matchIds: number[] = [];
    let report: any;
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO reports (reporter_id, reported_id, reason, status, updated_at)
         VALUES ($1, $2, $3, 'pending', NOW())
         RETURNING id, reporter_id, reported_id, reason, status, created_at`,
        [userId, reportedId, fullReason.slice(0, 500)]
      );
      report = result.rows[0];
      matchIds = await applyBlock(client, userId, reportedId);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    announceBlock(userId, reportedId, matchIds);

    return res.status(201).json({
      message: 'Report submitted',
      report,
      blocked: true,
    });
  } catch (error) {
    console.error('Create report error:', error);
    return res.status(500).json({ error: 'Failed to submit report' });
  }
};
