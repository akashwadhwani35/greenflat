import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { DAILY_LIMITS, LIKE_RESET_HOURS, COOLDOWN_DURATION_HOURS } from '../utils/constants';

// Helper to reset activity limits if needed
const checkAndResetLimits = async (userId: number, client: any) => {
  const result = await client.query(
    'SELECT * FROM user_activity_limits WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    // Create if doesn't exist
    await client.query(
      'INSERT INTO user_activity_limits (user_id) VALUES ($1)',
      [userId]
    );
    return { on_grid_likes_count: 0, off_grid_likes_count: 0, messages_started_count: 0 };
  }

  const limits = result.rows[0];
  const lastReset = new Date(limits.last_reset_at);
  const now = new Date();
  const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

  if (hoursSinceReset >= LIKE_RESET_HOURS) {
    // Reset limits
    await client.query(
      `UPDATE user_activity_limits
       SET on_grid_likes_count = 0, off_grid_likes_count = 0,
           messages_started_count = 0, last_reset_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
    return { on_grid_likes_count: 0, off_grid_likes_count: 0, messages_started_count: 0 };
  }

  return limits;
};

export const likeProfile = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const userId = req.userId!;
    const { target_user_id, is_on_grid } = req.body;

    if (!target_user_id) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    await client.query('BEGIN');

    // Get current user
    const userResult = await client.query(
      'SELECT gender, is_premium, cooldown_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check and reset limits if needed
    const limits = await checkAndResetLimits(userId, client);

    // Get daily limits based on gender
    const dailyLimits = user.gender === 'male' ? DAILY_LIMITS.male : DAILY_LIMITS.female;

    // Check if user has exceeded limits
    if (is_on_grid) {
      if (limits.on_grid_likes_count >= dailyLimits.on_grid_likes && !user.is_premium) {
        await client.query('ROLLBACK');
        return res.status(429).json({
          error: 'Daily on-grid like limit reached',
          limit: dailyLimits.on_grid_likes,
          reset_in_hours: LIKE_RESET_HOURS,
        });
      }
    } else {
      if (limits.off_grid_likes_count >= dailyLimits.off_grid_likes && !user.is_premium) {
        await client.query('ROLLBACK');
        return res.status(429).json({
          error: 'Daily off-grid like limit reached',
          limit: dailyLimits.off_grid_likes,
          reset_in_hours: LIKE_RESET_HOURS,
        });
      }
    }

    // Check if target user is in cooldown
    const targetUserResult = await client.query(
      'SELECT cooldown_until FROM users WHERE id = $1',
      [target_user_id]
    );

    if (targetUserResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Target user not found' });
    }

    const targetUser = targetUserResult.rows[0];
    if (targetUser.cooldown_until && new Date(targetUser.cooldown_until) > new Date()) {
      if (!user.is_premium) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'This user is currently in cooldown',
          can_bookmark: true,
        });
      }
      // Premium users can bookmark
    }

    // Check if already liked
    const existingLike = await client.query(
      'SELECT id FROM likes WHERE liker_id = $1 AND liked_id = $2',
      [userId, target_user_id]
    );

    if (existingLike.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already liked this user' });
    }

    // Create the like
    await client.query(
      'INSERT INTO likes (liker_id, liked_id, is_on_grid) VALUES ($1, $2, $3)',
      [userId, target_user_id, is_on_grid]
    );

    // Update activity limits
    if (is_on_grid) {
      await client.query(
        'UPDATE user_activity_limits SET on_grid_likes_count = on_grid_likes_count + 1 WHERE user_id = $1',
        [userId]
      );
    } else {
      await client.query(
        'UPDATE user_activity_limits SET off_grid_likes_count = off_grid_likes_count + 1 WHERE user_id = $1',
        [userId]
      );
    }

    // Check if it's a mutual like
    const mutualLikeResult = await client.query(
      'SELECT id FROM likes WHERE liker_id = $1 AND liked_id = $2',
      [target_user_id, userId]
    );

    let isMatch = false;
    let matchId = null;

    if (mutualLikeResult.rows.length > 0) {
      // Create a match
      const matchResult = await client.query(
        `INSERT INTO matches (user1_id, user2_id)
         VALUES (LEAST($1, $2), GREATEST($1, $2))
         ON CONFLICT (user1_id, user2_id) DO NOTHING
         RETURNING id`,
        [userId, target_user_id]
      );

      if (matchResult.rows.length > 0) {
        isMatch = true;
        matchId = matchResult.rows[0].id;
      }
    }

    // Check if current user should enter cooldown
    const updatedLimits = await client.query(
      'SELECT * FROM user_activity_limits WHERE user_id = $1',
      [userId]
    );

    const currentLimits = updatedLimits.rows[0];
    const totalLikes = currentLimits.on_grid_likes_count + currentLimits.off_grid_likes_count;
    const maxLikes = dailyLimits.on_grid_likes + dailyLimits.off_grid_likes;

    if (totalLikes >= maxLikes && user.cooldown_enabled) {
      // Enable cooldown
      const cooldownUntil = new Date();
      cooldownUntil.setHours(cooldownUntil.getHours() + COOLDOWN_DURATION_HOURS);

      await client.query(
        'UPDATE users SET cooldown_until = $1 WHERE id = $2',
        [cooldownUntil, userId]
      );
    }

    await client.query('COMMIT');

    res.json({
      message: 'Profile liked successfully',
      is_match: isMatch,
      match_id: matchId,
      likes_remaining: {
        on_grid: Math.max(0, dailyLimits.on_grid_likes - currentLimits.on_grid_likes_count),
        off_grid: Math.max(0, dailyLimits.off_grid_likes - currentLimits.off_grid_likes_count),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Like profile error:', error);
    res.status(500).json({ error: 'Failed to like profile' });
  } finally {
    client.release();
  }
};

export const getLikesRemaining = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const userResult = await pool.query(
      'SELECT gender, is_premium FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const dailyLimits = user.gender === 'male' ? DAILY_LIMITS.male : DAILY_LIMITS.female;

    const limitsResult = await pool.query(
      'SELECT * FROM user_activity_limits WHERE user_id = $1',
      [userId]
    );

    const limits = limitsResult.rows[0] || {
      on_grid_likes_count: 0,
      off_grid_likes_count: 0,
      messages_started_count: 0,
    };

    res.json({
      on_grid_remaining: Math.max(0, dailyLimits.on_grid_likes - limits.on_grid_likes_count),
      off_grid_remaining: Math.max(0, dailyLimits.off_grid_likes - limits.off_grid_likes_count),
      messages_remaining: Math.max(0, dailyLimits.messages_per_day - limits.messages_started_count),
      is_premium: user.is_premium,
    });
  } catch (error) {
    console.error('Get likes remaining error:', error);
    res.status(500).json({ error: 'Failed to fetch limits' });
  }
};

export const getMatches = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const result = await pool.query(
      `SELECT
        m.id as match_id,
        m.matched_at,
        u.id as user_id,
        u.name,
        u.date_of_birth,
        u.city,
        u.is_verified,
        (SELECT photo_url FROM photos WHERE user_id = u.id AND is_primary = TRUE LIMIT 1) as primary_photo,
        p.bio,
        p.interests
      FROM matches m
      JOIN users u ON (u.id = m.user1_id OR u.id = m.user2_id) AND u.id != $1
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE m.user1_id = $1 OR m.user2_id = $1
      ORDER BY m.matched_at DESC`,
      [userId]
    );

    res.json({
      matches: result.rows,
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
};
