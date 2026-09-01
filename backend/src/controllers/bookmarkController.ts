/**
 * Bookmarks.
 *
 * When someone hits their daily like limit their profile enters cooldown and
 * stops receiving new likes. A bookmark is what you get instead: it saves the
 * profile so you can like them the moment they come back.
 *
 * Deliberately NOT a way around the cooldown. Bookmarking sends nothing, the
 * bookmarked person is never told, and liking still has to happen later through
 * the normal quota. The product spec is explicit that premium buys convenience,
 * not reach, and that it must never amount to buying the ability to target a
 * specific person.
 */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

const isPremiumNow = (user: { is_premium?: boolean; premium_expires_at?: Date | string | null }) => {
  if (!user?.is_premium) return false;
  if (!user.premium_expires_at) return true;
  return new Date(user.premium_expires_at).getTime() > Date.now();
};

const requirePremium = async (userId: number) => {
  const result = await pool.query(
    'SELECT is_premium, premium_expires_at FROM users WHERE id = $1',
    [userId]
  );
  return isPremiumNow(result.rows[0] || {});
};

export const createBookmark = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const targetUserId = Number(req.body?.target_user_id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'A valid target_user_id is required' });
    }
    if (targetUserId === userId) {
      return res.status(400).json({ error: 'You cannot bookmark yourself' });
    }

    if (!(await requirePremium(userId))) {
      return res.status(403).json({
        error: 'Bookmarks are a paid feature',
        upgrade_required: true,
      });
    }

    const target = await pool.query(
      'SELECT id, onboarding_completed_at FROM users WHERE id = $1 AND is_banned = FALSE',
      [targetUserId]
    );
    if (target.rows.length === 0 || !target.rows[0].onboarding_completed_at) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // A block in either direction hides the profile, so it must not be saveable.
    const blocked = await pool.query(
      `SELECT 1 FROM blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`,
      [userId, targetUserId]
    );
    if (blocked.rows.length > 0) {
      return res.status(403).json({ error: 'Profile unavailable' });
    }

    await pool.query(
      `INSERT INTO bookmarks (user_id, bookmarked_user_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, bookmarked_user_id) DO NOTHING`,
      [userId, targetUserId]
    );

    return res.status(201).json({ message: 'Saved', bookmarked: true });
  } catch (error) {
    console.error('Create bookmark error:', error);
    return res.status(500).json({ error: 'Failed to save bookmark' });
  }
};

/**
 * The saved profiles, newest first.
 *
 * `is_available` is the field the list is really for: it says whether this
 * person's cooldown has passed, which is the moment a bookmark becomes
 * actionable. Blocked and banned profiles drop out of the list entirely rather
 * than appearing as dead entries.
 */
export const getBookmarks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const result = await pool.query(
      `SELECT
         u.id, u.name, u.date_of_birth, u.city, u.is_verified, u.pronouns,
         u.cooldown_until,
         p.bio, p.interests,
         primary_photo.photo_url AS primary_photo,
         b.created_at AS bookmarked_at,
         existing_like.id IS NOT NULL AS already_liked
       FROM bookmarks b
       JOIN users u ON u.id = b.bookmarked_user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN photos primary_photo
         ON primary_photo.user_id = u.id AND primary_photo.is_primary = TRUE
       LEFT JOIN likes existing_like
         ON existing_like.liker_id = $1 AND existing_like.liked_id = u.id
       LEFT JOIN blocks blocked_rel
         ON ((blocked_rel.blocker_id = $1 AND blocked_rel.blocked_id = u.id)
          OR (blocked_rel.blocker_id = u.id AND blocked_rel.blocked_id = $1))
       WHERE b.user_id = $1
         AND u.is_banned = FALSE
         AND u.onboarding_completed_at IS NOT NULL
         AND blocked_rel.id IS NULL
       ORDER BY b.created_at DESC`,
      [userId]
    );

    const now = Date.now();
    const calculateAge = (dob: any) => {
      if (!dob) return null;
      const birth = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
      return age;
    };

    const bookmarks = result.rows.map((row: any) => {
      const cooldownUntil = row.cooldown_until ? new Date(row.cooldown_until).getTime() : null;
      const inCooldown = Boolean(cooldownUntil && cooldownUntil > now);
      return {
        id: row.id,
        name: row.name,
        age: calculateAge(row.date_of_birth),
        city: row.city,
        pronouns: row.pronouns || [],
        is_verified: row.is_verified,
        bio: row.bio,
        interests: row.interests || [],
        primary_photo: row.primary_photo,
        bookmarked_at: row.bookmarked_at,
        already_liked: Boolean(row.already_liked),
        in_cooldown: inCooldown,
        // What the UI acts on: can this be liked right now?
        is_available: !inCooldown && !row.already_liked,
        available_at: inCooldown ? new Date(cooldownUntil!).toISOString() : null,
      };
    });

    return res.json({
      bookmarks,
      available_count: bookmarks.filter((b: { is_available: boolean }) => b.is_available).length,
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    return res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
};

export const deleteBookmark = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const targetUserId = Number(req.params.targetUserId);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'A valid target user id is required' });
    }

    await pool.query('DELETE FROM bookmarks WHERE user_id = $1 AND bookmarked_user_id = $2', [
      userId,
      targetUserId,
    ]);

    return res.json({ message: 'Removed', bookmarked: false });
  } catch (error) {
    console.error('Delete bookmark error:', error);
    return res.status(500).json({ error: 'Failed to remove bookmark' });
  }
};
