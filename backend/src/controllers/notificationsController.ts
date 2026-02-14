import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

const getPrefs = async (userId: number) => {
  const result = await pool.query(
    `SELECT likes, matches, messages, daily_picks, product_updates
     FROM user_notification_preferences
     WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length > 0) return result.rows[0];
  return {
    likes: true,
    matches: true,
    messages: true,
    daily_picks: true,
    product_updates: true,
  };
};

export const getNotificationPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const preferences = await getPrefs(userId);
    return res.json({ preferences });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    return res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
};

export const updateNotificationPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { likes, matches, messages, daily_picks, product_updates } = req.body as {
      likes?: boolean;
      matches?: boolean;
      messages?: boolean;
      daily_picks?: boolean;
      product_updates?: boolean;
    };

    await pool.query(
      `INSERT INTO user_notification_preferences (
         user_id, likes, matches, messages, daily_picks, product_updates, updated_at
       ) VALUES (
         $1,
         COALESCE($2, TRUE),
         COALESCE($3, TRUE),
         COALESCE($4, TRUE),
         COALESCE($5, TRUE),
         COALESCE($6, TRUE),
         NOW()
       )
       ON CONFLICT (user_id)
       DO UPDATE SET
         likes = COALESCE($2, user_notification_preferences.likes),
         matches = COALESCE($3, user_notification_preferences.matches),
         messages = COALESCE($4, user_notification_preferences.messages),
         daily_picks = COALESCE($5, user_notification_preferences.daily_picks),
         product_updates = COALESCE($6, user_notification_preferences.product_updates),
         updated_at = NOW()`,
      [userId, likes, matches, messages, daily_picks, product_updates]
    );

    const preferences = await getPrefs(userId);
    return res.json({ message: 'Notification preferences updated', preferences });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    return res.status(500).json({ error: 'Failed to update notification preferences' });
  }
};
