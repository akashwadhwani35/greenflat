import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { DAILY_LIMITS, LIKE_RESET_HOURS, COOLDOWN_DURATION_HOURS, TOKEN_COSTS } from '../utils/constants';
import { notifyLikeReceived, notifyMatch, notifyFirstMove, notifyAccepted } from '../services/push.service';
import { consumeCredits, ensureDailyAllowance } from '../services/credits.service';
import { getIO } from '../socket';

// Badge counts on the tabs: tell the phone something changed so it refetches.
const pokeCounts = (...userIds: number[]) => {
  const io = getIO();
  if (!io) return;
  for (const id of userIds) io.to(`user:${id}`).emit('counts:changed', {});
};

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

    // Superlikes cost tokens, so settle the free allowance first.
    await ensureDailyAllowance(userId);

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
      // Cooldown blocks likes from EVERYONE, paid or not.
      //
      // This previously let premium through and told only free users to
      // bookmark, which inverted the mechanic: cooldown exists to stop someone
      // who has hit their limit from being flooded, and a paid bypass is exactly
      // the "buying reach at another user's expense" the spec rules out. Paying
      // gets you a bookmark, so you are first in line when they return.
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'This user is currently in cooldown',
        can_bookmark: true,
        available_at: new Date(targetUser.cooldown_until).toISOString(),
      });
    }

    const blockResult = await client.query(
      `SELECT 1
       FROM blocks
       WHERE ((blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1))
         AND unblocked_at IS NULL
       LIMIT 1`,
      [userId, target_user_id]
    );
    if (blockResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot like this user due to privacy settings' });
    }

    // Check if already liked
    const existingLike = await client.query(
      'SELECT id, is_superlike FROM likes WHERE liker_id = $1 AND liked_id = $2',
      [userId, target_user_id]
    );

    if (existingLike.rows.length > 0) {
      const existing = existingLike.rows[0];
      const alreadySuperliked = Boolean(existing.is_superlike);

      // Allow upgrading an existing like to superlike so it can be prioritized in incoming likes.
      if (Boolean(is_superlike) && !alreadySuperliked) {
        try {
          await consumeCredits(
            userId,
            TOKEN_COSTS.SUPER_LIKE,
            'superlike',
            { target_user_id, upgraded_existing_like: true },
            client
          );
        } catch (error: any) {
          await client.query('ROLLBACK');
          if (error.message === 'INSUFFICIENT_CREDITS') {
            return res.status(402).json({ error: 'Not enough tokens. Green Flags cost 4 tokens.' });
          }
          throw error;
        }

        await client.query(
          `UPDATE likes
           SET is_superlike = TRUE,
               created_at = NOW()
           WHERE id = $1`,
          [existing.id]
        );

        await client.query('COMMIT');
        return res.json({
          message: 'Green Flag sent!',
          is_match: false,
          match_id: null,
          is_superlike: true,
          likes_remaining: {
            on_grid: Math.max(0, dailyLimits.on_grid_likes - limits.on_grid_likes_count),
            off_grid: Math.max(0, dailyLimits.off_grid_likes - limits.off_grid_likes_count),
          },
        });
      }

      await client.query('ROLLBACK');
      return res.status(400).json({
        error: alreadySuperliked
          ? 'You have already sent this person a Green Flag'
          : 'You have already liked this user',
        already_liked: true,
      });
    }

    // Check if user has exceeded limits (only for new likes, not upgrades).
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

    // Superlike costs tokens
    if (is_superlike) {
      try {
        await consumeCredits(
          userId,
          TOKEN_COSTS.SUPER_LIKE,
          'superlike',
          { target_user_id },
          client
        );
      } catch (error: any) {
        await client.query('ROLLBACK');
        if (error.message === 'INSUFFICIENT_CREDITS') {
          return res.status(402).json({ error: 'Not enough tokens. Green Flags cost 4 tokens.' });
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
        `INSERT INTO matches (user1_id, user2_id, status, requested_by)
         VALUES (LEAST($1::int, $2::int), GREATEST($1::int, $2::int), 'active', NULL)
         ON CONFLICT (user1_id, user2_id)
         DO UPDATE SET status = 'active'
         WHERE matches.status <> 'active'
         RETURNING id`,
        [userId, target_user_id]
      );

      if (matchResult.rows.length > 0) {
        isMatch = true;
        matchId = matchResult.rows[0].id;

        // Liking back someone who sent a Green Flag is accepting it: they
        // hear that, not a generic match line.
        const theirLike = await client.query(
          'SELECT is_superlike FROM likes WHERE liker_id = $1 AND liked_id = $2',
          [target_user_id, userId]
        );
        const theyGreenFlagged = Boolean(theirLike.rows[0]?.is_superlike);
        notifyMatch(userId, targetName).catch(err => console.error('Failed to send match notification:', err));
        (theyGreenFlagged
          ? notifyAccepted(target_user_id, likerName, 'green_flag')
          : notifyMatch(target_user_id, likerName)
        ).catch(err => console.error('Failed to send match notification:', err));
      }
    } else {
      // Not a match yet - notify the target user they received a like
      notifyLikeReceived(target_user_id, likerName).catch(err => console.error('Failed to send like notification:', err));
    }
    pokeCounts(target_user_id, userId);

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
      message: is_superlike ? 'Green Flag sent!' : 'Profile liked successfully',
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
         primary_photo.photo_url as primary_photo
       FROM likes l
       JOIN users liker ON liker.id = l.liker_id
       LEFT JOIN photos primary_photo
         ON primary_photo.user_id = liker.id
        AND primary_photo.is_primary = TRUE
       LEFT JOIN blocks blocked_rel
         ON ((blocked_rel.blocker_id = $1 AND blocked_rel.blocked_id = liker.id)
          OR (blocked_rel.blocker_id = liker.id AND blocked_rel.blocked_id = $1))
       -- Once the like has been answered (liked back, so a match exists) it is
       -- no longer pending and leaves the inbox. Rejecting deletes the row
       -- outright, so both outcomes clear the card.
       LEFT JOIN matches active_match
         ON ((active_match.user1_id = $1 AND active_match.user2_id = liker.id)
          OR (active_match.user1_id = liker.id AND active_match.user2_id = $1))
        AND active_match.status = 'active'
       WHERE l.liked_id = $1
         AND blocked_rel.id IS NULL
         AND active_match.id IS NULL
         AND COALESCE(l.is_compliment, FALSE) = FALSE
       ORDER BY COALESCE(l.is_superlike, FALSE) DESC, l.created_at DESC
       LIMIT 50`,
      [userId]
    );

    // Opening the inbox clears the Likes badge.
    await pool.query(
      'UPDATE likes SET seen_at = NOW() WHERE liked_id = $1 AND seen_at IS NULL',
      [userId]
    );

    const likes = result.rows.map((row: any) => ({
      id: row.id,
      is_on_grid: row.is_on_grid,
      is_superlike: Boolean(row.is_superlike),
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
    const { target_user_id, content, photo_url } = req.body as {
      target_user_id?: number;
      content?: string;
      /** The photo the First Move was sent from, shown small in the chat. */
      photo_url?: string;
    };
    const photoUrl = typeof photo_url === 'string' && /^https?:\/\//.test(photo_url.trim()) ? photo_url.trim().slice(0, 1000) : null;

    // Compliments cost tokens, so settle the free allowance first.
    await ensureDailyAllowance(userId);

    if (!target_user_id || target_user_id === userId) {
      return res.status(400).json({ error: 'Valid target user ID is required' });
    }

    const complimentText = (content || '').trim().slice(0, 300);
    if (!complimentText) {
      return res.status(400).json({ error: 'Write your First Move first' });
    }

    await client.query('BEGIN');

    const targetUserResult = await client.query('SELECT id, name FROM users WHERE id = $1', [target_user_id]);
    if (targetUserResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Target user not found' });
    }

    // One compliment per person. Checked before the tokens are taken so a
    // second tap costs nothing and says why.
    const existingLike = await client.query(
      'SELECT id, is_compliment FROM likes WHERE liker_id = $1 AND liked_id = $2',
      [userId, target_user_id]
    );
    if (existingLike.rows.length > 0 && existingLike.rows[0].is_compliment) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'You have already made your First Move with this person',
        already_complimented: true,
      });
    }

    let remainingCredits = 0;
    try {
      remainingCredits = await consumeCredits(
        userId,
        TOKEN_COSTS.COMPLIMENT,
        'compliment_send',
        { target_user_id, preview: complimentText.slice(0, 80) },
        client
      );
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error.message === 'INSUFFICIENT_CREDITS') {
        return res.status(402).json({ error: 'Not enough tokens. A First Move costs 6 tokens.' });
      }
      throw error;
    }

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

    // The compliment goes to their Messages, not a likes list. If they had
    // already liked the sender it is simply a match; otherwise the chat opens
    // in a pending state and they choose Accept or Not my type.
    const mutual = await client.query(
      'SELECT 1 FROM likes WHERE liker_id = $1 AND liked_id = $2',
      [target_user_id, userId]
    );
    const isMutual = mutual.rows.length > 0;
    const matchRow = await client.query(
      `INSERT INTO matches (user1_id, user2_id, status, requested_by)
       VALUES (LEAST($1::int, $2::int), GREATEST($1::int, $2::int), $3, $4)
       ON CONFLICT (user1_id, user2_id)
       DO UPDATE SET
         status = CASE WHEN matches.status = 'active' OR EXCLUDED.status = 'active' THEN 'active' ELSE matches.status END,
         requested_by = COALESCE(matches.requested_by, EXCLUDED.requested_by)
       RETURNING id, status`,
      [userId, target_user_id, isMutual ? 'active' : 'pending', isMutual ? null : userId]
    );
    const matchId: number = matchRow.rows[0].id;
    const matchStatus: string = matchRow.rows[0].status;

    const senderRow = await client.query('SELECT name FROM users WHERE id = $1', [userId]);
    const senderName: string = senderRow.rows[0]?.name || 'Someone';
    const targetName: string = targetUserResult.rows[0]?.name || 'Someone';

    // No automatic greeting: the First Move is the photo it was sent from
    // (if any) and the person's own words, nothing else.
    const inserted: any[] = [];
    if (photoUrl) {
      const row = await client.query(
        `INSERT INTO messages (match_id, sender_id, recipient_id, content, message_type, kind)
         VALUES ($1, $2, $3, $4, 'image', 'first_move_photo')
         RETURNING *`,
        [matchId, userId, target_user_id, photoUrl]
      );
      inserted.push(row.rows[0]);
    }
    const textRow = await client.query(
      `INSERT INTO messages (match_id, sender_id, recipient_id, content, message_type, kind)
       VALUES ($1, $2, $3, $4, 'text', 'first_move')
       RETURNING *`,
      [matchId, userId, target_user_id, complimentText]
    );
    inserted.push(textRow.rows[0]);
    await client.query('UPDATE matches SET last_message_at = NOW() WHERE id = $1', [matchId]);

    await client.query('COMMIT');

    const io = getIO();
    if (io) {
      for (const message of inserted) {
        io.to(`user:${target_user_id}`).emit('message:new', { message, matchId });
        io.to(`user:${userId}`).emit('message:new', { message, matchId });
      }
      const payload = { matchId, lastMessage: complimentText, lastMessageTime: inserted[inserted.length - 1]?.created_at, status: matchStatus };
      io.to(`user:${target_user_id}`).emit('conversation:updated', payload);
      io.to(`user:${userId}`).emit('conversation:updated', payload);
    }
    pokeCounts(target_user_id, userId);
    notifyFirstMove(target_user_id, senderName, complimentText).catch((err) =>
      console.error('Failed to send First Move notification:', err)
    );
    if (isMutual) {
      notifyMatch(userId, targetName).catch(() => {});
      notifyMatch(target_user_id, senderName).catch(() => {});
    }

    res.json({
      message: 'First Move sent',
      credit_balance: remainingCredits,
      match_id: matchId,
      match_status: matchStatus,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Send First Move error:', error);
    res.status(500).json({ error: 'Failed to send your First Move' });
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
          AND blocked_rel.unblocked_at IS NULL
      WHERE (m.user1_id = $1 OR m.user2_id = $1)
        AND m.status = 'active'
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


/**
 * Accept a compliment request: the pending conversation becomes a match and
 * both people can message. Only the person who received it can accept.
 */
export const acceptMatchRequest = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = req.userId!;
    const matchId = Number(req.params.matchId);
    if (!Number.isFinite(matchId)) return res.status(400).json({ error: 'Invalid match id' });

    await client.query('BEGIN');
    const found = await client.query(
      'SELECT id, user1_id, user2_id, status, requested_by FROM matches WHERE id = $1 FOR UPDATE',
      [matchId]
    );
    const match = found.rows[0];
    if (!match || (match.user1_id !== userId && match.user2_id !== userId)) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }
    if (match.status === 'active') {
      await client.query('ROLLBACK');
      return res.json({ match_id: matchId, status: 'active' });
    }
    if (match.requested_by === userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Waiting for them to accept' });
    }
    const otherId = match.user1_id === userId ? match.user2_id : match.user1_id;

    await client.query(
      "UPDATE matches SET status = 'active', matched_at = NOW() WHERE id = $1",
      [matchId]
    );
    // Accepting is a like back, so the likes table tells the same story.
    await client.query(
      `INSERT INTO likes (liker_id, liked_id, is_on_grid, is_superlike, is_compliment)
       VALUES ($1, $2, TRUE, FALSE, FALSE)
       ON CONFLICT (liker_id, liked_id) DO NOTHING`,
      [userId, otherId]
    );
    const names = await client.query('SELECT id, name FROM users WHERE id = ANY($1::int[])', [[userId, otherId]]);
    await client.query('COMMIT');

    const nameOf = (id: number) => names.rows.find((r: any) => r.id === id)?.name || 'Someone';
    notifyAccepted(otherId, nameOf(userId), 'first_move').catch(() => {});
    const io = getIO();
    if (io) {
      const payload = { matchId, status: 'active' };
      io.to(`user:${otherId}`).emit('conversation:updated', payload);
      io.to(`user:${userId}`).emit('conversation:updated', payload);
    }
    pokeCounts(otherId, userId);

    res.json({ match_id: matchId, status: 'active' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Failed to accept request' });
  } finally {
    client.release();
  }
};

/**
 * "Not my type": the request and its messages go away for both people, and
 * the sender's like is removed so it does not resurface anywhere.
 */
export const declineMatchRequest = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = req.userId!;
    const matchId = Number(req.params.matchId);
    if (!Number.isFinite(matchId)) return res.status(400).json({ error: 'Invalid match id' });

    await client.query('BEGIN');
    const found = await client.query(
      'SELECT id, user1_id, user2_id, status, requested_by FROM matches WHERE id = $1 FOR UPDATE',
      [matchId]
    );
    const match = found.rows[0];
    if (!match || (match.user1_id !== userId && match.user2_id !== userId)) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }
    if (match.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This conversation is already open. Unmatch instead.' });
    }
    const otherId = match.user1_id === userId ? match.user2_id : match.user1_id;

    await client.query('DELETE FROM messages WHERE match_id = $1', [matchId]);
    await client.query('DELETE FROM matches WHERE id = $1', [matchId]);
    await client.query('DELETE FROM likes WHERE liker_id = $1 AND liked_id = $2', [otherId, userId]);
    await client.query('COMMIT');

    const io = getIO();
    if (io) {
      io.to(`user:${otherId}`).emit('conversation:removed', { matchId });
      io.to(`user:${userId}`).emit('conversation:removed', { matchId });
    }
    pokeCounts(otherId, userId);

    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Decline request error:', error);
    res.status(500).json({ error: 'Failed to decline request' });
  } finally {
    client.release();
  }
};

/**
 * Numbers for the badges on the Likes and Chat tabs.
 */
export const getBadgeCounts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const [messages, likes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS n
         FROM messages msg
         JOIN matches m ON m.id = msg.match_id
         WHERE msg.recipient_id = $1 AND msg.is_read = FALSE AND msg.is_deleted = FALSE
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE ((b.blocker_id = $1 AND b.blocked_id = msg.sender_id)
                 OR (b.blocker_id = msg.sender_id AND b.blocked_id = $1))
               AND b.unblocked_at IS NULL
           )`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n
         FROM likes l
         WHERE l.liked_id = $1 AND l.seen_at IS NULL AND COALESCE(l.is_compliment, FALSE) = FALSE
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE ((b.blocker_id = $1 AND b.blocked_id = l.liker_id)
                 OR (b.blocker_id = l.liker_id AND b.blocked_id = $1))
               AND b.unblocked_at IS NULL
           )`,
        [userId]
      ),
    ]);
    res.json({ messages: messages.rows[0].n, likes: likes.rows[0].n });
  } catch (error) {
    console.error('Badge counts error:', error);
    res.status(500).json({ error: 'Failed to fetch counts' });
  }
};


/**
 * Reject from the Likes inbox: the like goes away and the person will not be
 * shown again there. Only when there is no conversation yet.
 */
export const dismissIncomingLike = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const likerId = Number(req.params.likerId);
    if (!Number.isFinite(likerId)) return res.status(400).json({ error: 'Invalid user' });
    const matched = await pool.query(
      "SELECT 1 FROM matches WHERE user1_id = LEAST($1::int, $2::int) AND user2_id = GREATEST($1::int, $2::int) AND status = 'active'",
      [userId, likerId]
    );
    if (matched.rows.length > 0) {
      return res.status(409).json({ error: 'You already matched. Unmatch from the chat instead.' });
    }
    await pool.query('DELETE FROM likes WHERE liker_id = $1 AND liked_id = $2', [likerId, userId]);
    pokeCounts(userId);
    res.json({ ok: true });
  } catch (error) {
    console.error('Dismiss like error:', error);
    res.status(500).json({ error: 'Failed to dismiss' });
  }
};

/**
 * "XYZ accepted your Green Flag" / "... your First Move": the matches that
 * started with something this person sent and the other side said yes to.
 */
export const getAcceptedLikes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const result = await pool.query(
      `SELECT
         m.id AS match_id,
         m.matched_at,
         m.requested_by,
         other.id AS user_id,
         other.name,
         other.city,
         mine.is_superlike AS my_green_flag,
         primary_photo.photo_url AS primary_photo
       FROM matches m
       JOIN users other ON ((m.user1_id = $1 AND other.id = m.user2_id) OR (m.user2_id = $1 AND other.id = m.user1_id))
       LEFT JOIN likes mine ON mine.liker_id = $1 AND mine.liked_id = other.id
       LEFT JOIN photos primary_photo ON primary_photo.user_id = other.id AND primary_photo.is_primary = TRUE
       WHERE (m.user1_id = $1 OR m.user2_id = $1)
         AND m.status = 'active'
         AND (m.requested_by = $1 OR COALESCE(mine.is_superlike, FALSE) = TRUE)
       ORDER BY m.matched_at DESC
       LIMIT 50`,
      [userId]
    );
    const accepted = result.rows.map((row: any) => ({
      match_id: row.match_id,
      matched_at: row.matched_at,
      kind: row.requested_by === userId ? 'first_move' : 'green_flag',
      user: { id: row.user_id, name: row.name, city: row.city, primary_photo: row.primary_photo },
    }));
    res.json({ accepted });
  } catch (error) {
    console.error('Accepted likes error:', error);
    res.status(500).json({ error: 'Failed to fetch accepted' });
  }
};
