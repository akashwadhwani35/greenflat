import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

const loadSettings = async (userId: number) => {
  const result = await pool.query(
    `SELECT hide_distance, hide_city, incognito_mode, show_online_status
     FROM user_privacy_settings
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length > 0) return result.rows[0];

  // Create default settings if none exist
  const inserted = await pool.query(
    `INSERT INTO user_privacy_settings (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING hide_distance, hide_city, incognito_mode, show_online_status`,
    [userId]
  );

  return inserted.rows[0] || {
    hide_distance: false,
    hide_city: false,
    incognito_mode: false,
    show_online_status: true,
  };
};

export const getPrivacySettings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const settings = await loadSettings(userId);
    return res.json({ settings });
  } catch (error) {
    console.error('Get privacy settings error:', error);
    return res.status(500).json({ error: 'Failed to fetch privacy settings' });
  }
};

export const updatePrivacySettings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { hide_distance, hide_city, incognito_mode, show_online_status } = req.body as {
      hide_distance?: boolean;
      hide_city?: boolean;
      incognito_mode?: boolean;
      show_online_status?: boolean;
    };

    await pool.query(
      `INSERT INTO user_privacy_settings (
         user_id, hide_distance, hide_city, incognito_mode, show_online_status, updated_at
       ) VALUES ($1, COALESCE($2, FALSE), COALESCE($3, FALSE), COALESCE($4, FALSE), COALESCE($5, TRUE), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         hide_distance = COALESCE($2, user_privacy_settings.hide_distance),
         hide_city = COALESCE($3, user_privacy_settings.hide_city),
         incognito_mode = COALESCE($4, user_privacy_settings.incognito_mode),
         show_online_status = COALESCE($5, user_privacy_settings.show_online_status),
         updated_at = NOW()`,
      [userId, hide_distance, hide_city, incognito_mode, show_online_status]
    );

    const settings = await loadSettings(userId);
    return res.json({ message: 'Privacy settings updated', settings });
  } catch (error) {
    console.error('Update privacy settings error:', error);
    return res.status(500).json({ error: 'Failed to update privacy settings' });
  }
};

export const getBlockedUsers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const result = await pool.query(
      `SELECT b.blocked_id as user_id, u.name, u.city, u.is_verified, b.created_at
       FROM blocks b
       JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );
    return res.json({ blocked_users: result.rows });
  } catch (error) {
    console.error('Get blocked users error:', error);
    return res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
};

export const blockUser = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = req.userId!;
    const target_user_id = Number(req.body.target_user_id);

    if (!target_user_id || isNaN(target_user_id) || target_user_id === userId) {
      return res.status(400).json({ error: 'Valid target_user_id is required' });
    }

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO blocks (blocker_id, blocked_id)
       VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [userId, target_user_id]
    );

    // Ensure visibility/chat is removed both ways.
    await client.query(
      `DELETE FROM likes
       WHERE (liker_id = $1 AND liked_id = $2) OR (liker_id = $2 AND liked_id = $1)`,
      [userId, target_user_id]
    );
    // Delete messages first (before match cascade removes the match_id reference)
    await client.query(
      `DELETE FROM messages
       WHERE match_id IN (
         SELECT id FROM matches
         WHERE user1_id = LEAST($1::int, $2::int) AND user2_id = GREATEST($1::int, $2::int)
       )`,
      [userId, target_user_id]
    );

    await client.query(
      `DELETE FROM matches
       WHERE (user1_id = LEAST($1::int, $2::int) AND user2_id = GREATEST($1::int, $2::int))`,
      [userId, target_user_id]
    );

    await client.query('COMMIT');
    return res.json({ message: 'User blocked' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Block user error:', error);
    return res.status(500).json({ error: 'Failed to block user' });
  } finally {
    client.release();
  }
};

export const unblockUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { target_user_id } = req.body as { target_user_id?: number };
    if (!target_user_id) {
      return res.status(400).json({ error: 'target_user_id is required' });
    }

    await pool.query(
      `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [userId, target_user_id]
    );
    return res.json({ message: 'User unblocked' });
  } catch (error) {
    console.error('Unblock user error:', error);
    return res.status(500).json({ error: 'Failed to unblock user' });
  }
};
