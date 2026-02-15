import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { DAILY_LIMITS, LIKE_RESET_HOURS, COOLDOWN_DURATION_HOURS } from '../utils/constants';
import { notifyLikeReceived, notifyMatch } from '../services/push.service';
import { consumeCredits } from '../services/credits.service';

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
    const { target_user_id, is_on_grid, is_superlike } = req.body;

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

    const blockResult = await client.query(
      `SELECT 1
       FROM blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [userId, target_user_id]
    );
    if (blockResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot like this user due to privacy settings' });
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

    // Superlike costs 5 credits
    if (is_superlike) {
      try {
        await consumeCredits(
          userId,
          5,
          'superlike',
          { target_user_id },
          client
        );
      } catch (error: any) {
        await client.query('ROLLBACK');
        if (error.message === 'INSUFFICIENT_CREDITS') {
          return res.status(402).json({ error: 'Not enough credits. Superlikes cost 5 credits.' });
        }
        throw error;
      }
    }

    // Create the like
    await client.query(
      'INSERT INTO likes (liker_id, liked_id, is_on_grid, is_superlike) VALUES ($1, $2, $3, $4)',
      [userId, target_user_id, is_on_grid, Boolean(is_superlike)]
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

    // Get user names for notifications
    const likerNameResult = await client.query('SELECT name FROM users WHERE id = $1', [userId]);
    const targetNameResult = await client.query('SELECT name FROM users WHERE id = $1', [target_user_id]);
    const likerName = likerNameResult.rows[0]?.name || 'Someone';
    const targetName = targetNameResult.rows[0]?.name || 'Someone';

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
         VALUES (LEAST($1::int, $2::int), GREATEST($1::int, $2::int))
         ON CONFLICT (user1_id, user2_id) DO NOTHING
         RETURNING id`,
        [userId, target_user_id]
      );

      if (matchResult.rows.length > 0) {
        isMatch = true;
        matchId = matchResult.rows[0].id;

        // Send match notifications to both users
        notifyMatch(userId, targetName).catch(err => console.error('Failed to send match notification:', err));
        notifyMatch(target_user_id, likerName).catch(err => console.error('Failed to send match notification:', err));
      }
    } else {
      // Not a match yet - notify the target user they received a like
      notifyLikeReceived(target_user_id, likerName).catch(err => console.error('Failed to send like notification:', err));
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
      message: is_superlike ? 'Superlike sent!' : 'Profile liked successfully',
      is_match: isMatch,
      match_id: matchId,
      is_superlike: Boolean(is_superlike),
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
  const client = await pool.connect();
  try {
    const userId = req.userId!;

    const userResult = await client.query(
      'SELECT gender, is_premium, credit_balance FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const dailyLimits = user.gender === 'male' ? DAILY_LIMITS.male : DAILY_LIMITS.female;

    const limits = await checkAndResetLimits(userId, client);

    res.json({
      on_grid_remaining: Math.max(0, dailyLimits.on_grid_likes - limits.on_grid_likes_count),
      off_grid_remaining: Math.max(0, dailyLimits.off_grid_likes - limits.off_grid_likes_count),
      messages_remaining: Math.max(0, dailyLimits.messages_per_day - limits.messages_started_count),
      is_premium: user.is_premium,
      credit_balance: Number(user.credit_balance || 0),
    });
  } catch (error) {
    console.error('Get likes remaining error:', error);
    res.status(500).json({ error: 'Failed to fetch limits' });
  } finally {
    client.release();
  }
};

export const getIncomingLikes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const result = await pool.query(
      `SELECT
         l.id,
         l.is_on_grid,
         l.is_superlike,
         l.is_compliment,
         l.compliment_message,
         l.created_at,
         liker.id as user_id,
         liker.name,
         liker.city,
         liker.is_verified,
         liker.gender,
         liker.interested_in,
         liker.date_of_birth,
         (SELECT photo_url FROM photos WHERE user_id = liker.id AND is_primary = TRUE LIMIT 1) as primary_photo
       FROM likes l
       JOIN users liker ON liker.id = l.liker_id
       WHERE l.liked_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = liker.id)
              OR (b.blocker_id = liker.id AND b.blocked_id = $1)
         )
       ORDER BY l.is_superlike DESC, l.created_at DESC
       LIMIT 50`,
      [userId]
    );

    const likes = result.rows.map((row: any) => ({
      id: row.id,
      is_on_grid: row.is_on_grid,
      is_superlike: row.is_superlike,
      is_compliment: row.is_compliment,
      compliment_message: row.compliment_message,
      created_at: row.created_at,
      user: {
        id: row.user_id,
        name: row.name,
        city: row.city,
        is_verified: row.is_verified,
        gender: row.gender,
        interested_in: row.interested_in,
        age: row.date_of_birth ? Math.floor((Date.now() - new Date(row.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null,
        primary_photo: row.primary_photo,
      },
    }));

    res.json({ likes });
  } catch (error) {
    console.error('Get incoming likes error:', error);
    res.status(500).json({ error: 'Failed to fetch incoming likes' });
  }
};

export const sendCompliment = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const userId = req.userId!;
    const { target_user_id, content } = req.body as {
      target_user_id?: number;
      content?: string;
    };

    if (!target_user_id || target_user_id === userId) {
      return res.status(400).json({ error: 'Valid target user ID is required' });
    }

    const complimentText = (content || '').trim().slice(0, 300);
    if (!complimentText) {
      return res.status(400).json({ error: 'Compliment text is required' });
    }

    await client.query('BEGIN');

    const targetUserResult = await client.query('SELECT id, name FROM users WHERE id = $1', [target_user_id]);
    if (targetUserResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Target user not found' });
    }

    let remainingCredits = 0;
    try {
      remainingCredits = await consumeCredits(
        userId,
        5,
        'compliment_send',
        { target_user_id, preview: complimentText.slice(0, 80) },
        client
      );
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error.message === 'INSUFFICIENT_CREDITS') {
        return res.status(402).json({ error: 'Not enough credits. Compliments cost 5 credits.' });
      }
      throw error;
    }

    const existingLike = await client.query(
      'SELECT id FROM likes WHERE liker_id = $1 AND liked_id = $2',
      [userId, target_user_id]
    );

    if (existingLike.rows.length > 0) {
      await client.query(
        `UPDATE likes
         SET is_compliment = TRUE, compliment_message = $3, created_at = NOW()
         WHERE liker_id = $1 AND liked_id = $2`,
        [userId, target_user_id, complimentText]
      );
    } else {
      await client.query(
        `INSERT INTO likes (liker_id, liked_id, is_on_grid, is_compliment, compliment_message)
         VALUES ($1, $2, TRUE, TRUE, $3)`,
        [userId, target_user_id, complimentText]
      );
    }

    await client.query('COMMIT');

    res.json({
      message: 'Compliment sent successfully',
      credit_balance: remainingCredits,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Send compliment error:', error);
    res.status(500).json({ error: 'Failed to send compliment' });
  } finally {
    client.release();
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
        primary_photo.photo_url as primary_photo,
        p.bio,
        p.interests
      FROM matches m
      JOIN users u ON (u.id = m.user1_id OR u.id = m.user2_id) AND u.id != $1
      LEFT JOIN user_profiles p ON u.id = p.user_id
      LEFT JOIN photos primary_photo ON primary_photo.user_id = u.id AND primary_photo.is_primary = TRUE
      LEFT JOIN blocks blocked_rel
        ON ((blocked_rel.blocker_id = $1 AND blocked_rel.blocked_id = u.id)
         OR (blocked_rel.blocker_id = u.id AND blocked_rel.blocked_id = $1))
      WHERE (m.user1_id = $1 OR m.user2_id = $1)
        AND blocked_rel.id IS NULL
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
