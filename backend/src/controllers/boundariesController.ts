/**
 * Settings → My Boundaries.
 *
 * How much of other people's attention a person is willing to receive in a day.
 * The numbers are private: nobody browsing a profile can tell what they are set
 * to, or that any of it is switched on.
 */
import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { getIncomingLimits } from '../services/boundaries.service';

const MIN_LIMIT = 0;
const MAX_LIMIT = 100;

/** Anything outside 0-100, or not a whole number, is rejected rather than clamped. */
const readLimit = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < MIN_LIMIT || n > MAX_LIMIT) return null;
  return n;
};

export const getBoundaries = async (req: AuthRequest, res: Response) => {
  try {
    const row = await getIncomingLimits(req.userId!);
    return res.json({
      boundaries: {
        enabled: row.enabled,
        likes: Number(row.limit_likes),
        greenflags: Number(row.limit_greenflags),
        compliments: Number(row.limit_compliments),
        // What is left today, so the screen can show it.
        remaining: {
          likes: Math.max(0, Number(row.limit_likes) - Number(row.likes_count)),
          greenflags: Math.max(0, Number(row.limit_greenflags) - Number(row.greenflags_count)),
          compliments: Math.max(0, Number(row.limit_compliments) - Number(row.compliments_count)),
        },
        resets_at: new Date(new Date(row.last_reset_at).getTime() + 24 * 3600 * 1000).toISOString(),
      },
      range: { min: MIN_LIMIT, max: MAX_LIMIT },
    });
  } catch (error) {
    console.error('Get boundaries error:', error);
    return res.status(500).json({ error: 'Failed to load your boundaries' });
  }
};

export const updateBoundaries = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { enabled, likes, greenflags, compliments } = req.body ?? {};

    const parsed = {
      likes: readLimit(likes),
      greenflags: readLimit(greenflags),
      compliments: readLimit(compliments),
    };
    const invalid = Object.entries(parsed)
      .filter(([, value]) => value === null)
      .map(([key]) => key);
    if (invalid.length > 0) {
      return res.status(400).json({
        error: `A daily limit must be a whole number between ${MIN_LIMIT} and ${MAX_LIMIT}.`,
        fields: invalid,
      });
    }

    // Make sure the row exists before updating it.
    await getIncomingLimits(userId);

    const result = await pool.query(
      `UPDATE user_incoming_limits
          SET enabled           = COALESCE($2, enabled),
              limit_likes       = COALESCE($3, limit_likes),
              limit_greenflags  = COALESCE($4, limit_greenflags),
              limit_compliments = COALESCE($5, limit_compliments),
              updated_at        = NOW()
        WHERE user_id = $1
        RETURNING enabled, limit_likes, limit_greenflags, limit_compliments`,
      [
        userId,
        typeof enabled === 'boolean' ? enabled : null,
        parsed.likes ?? null,
        parsed.greenflags ?? null,
        parsed.compliments ?? null,
      ]
    );

    const row = result.rows[0];
    return res.json({
      boundaries: {
        enabled: row.enabled,
        likes: Number(row.limit_likes),
        greenflags: Number(row.limit_greenflags),
        compliments: Number(row.limit_compliments),
      },
    });
  } catch (error) {
    console.error('Update boundaries error:', error);
    return res.status(500).json({ error: 'Failed to save your boundaries' });
  }
};
