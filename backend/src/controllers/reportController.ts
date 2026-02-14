import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const createReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { match_id, reason } = req.body as { match_id?: number; reason?: string };

    if (!match_id || !reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'match_id and reason are required' });
    }

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

    const reportedId = match.user1_id === userId ? match.user2_id : match.user1_id;

    const result = await pool.query(
      `INSERT INTO reports (reporter_id, reported_id, reason, status, updated_at)
       VALUES ($1, $2, $3, 'pending', NOW())
       RETURNING id, reporter_id, reported_id, reason, status, created_at`,
      [userId, reportedId, reason.trim().slice(0, 500)]
    );

    return res.status(201).json({
      message: 'Report submitted',
      report: result.rows[0],
    });
  } catch (error) {
    console.error('Create report error:', error);
    return res.status(500).json({ error: 'Failed to submit report' });
  }
};
