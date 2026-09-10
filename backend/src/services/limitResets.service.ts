/**
 * Telling people their limits have come back.
 *
 * Both windows reset lazily — the counters only clear on the owner's next
 * request — so nothing in the request path can announce a reset to someone who
 * has closed the app. That is exactly who needs telling, hence a sweep.
 *
 * Each user is notified at most once per window: the ledger columns
 * (likes_reset_notified_at, explore_window_notified_at) are stamped in the same
 * statement that selects them, so two instances running the sweep at once
 * cannot both send.
 */
import pool from '../config/database';
import { LIKE_RESET_HOURS, DAILY_LIMITS } from '../utils/constants';
import { EXPLORE_WINDOW_HOURS } from './boundaries.service';
import { notifyLikesBack, notifyExploreRefreshed } from './push.service';

/**
 * People whose 12-hour like window has elapsed and who had actually run out.
 * Someone who never hit the limit has nothing to be told.
 */
const sweepLikeResets = async (): Promise<number> => {
  const result = await pool.query(
    `UPDATE user_activity_limits ual
        SET likes_reset_notified_at = NOW()
       FROM users u
      WHERE u.id = ual.user_id
        AND ual.last_reset_at <= NOW() - ($1 || ' hours')::interval
        AND (
          ual.likes_reset_notified_at IS NULL
          OR ual.likes_reset_notified_at < ual.last_reset_at
        )
        AND (
          (u.gender = 'male'  AND (ual.on_grid_likes_count >= $2 OR ual.off_grid_likes_count >= $3))
          OR
          (u.gender <> 'male' AND (ual.on_grid_likes_count >= $4 OR ual.off_grid_likes_count >= $5))
        )
      RETURNING ual.user_id`,
    [
      String(LIKE_RESET_HOURS),
      DAILY_LIMITS.male.on_grid_likes,
      DAILY_LIMITS.male.off_grid_likes,
      DAILY_LIMITS.female.on_grid_likes,
      DAILY_LIMITS.female.off_grid_likes,
    ]
  );

  for (const row of result.rows) {
    notifyLikesBack(row.user_id).catch((err) =>
      console.error('notifyLikesBack failed', row.user_id, err)
    );
  }
  return result.rows.length;
};

/**
 * Unlimited plans whose six-hour Explore window has run out and rolled over.
 * Only those who actually spent the window are worth waking up.
 */
const sweepExploreWindows = async (): Promise<number> => {
  const result = await pool.query(
    `UPDATE user_activity_limits
        SET explore_window_notified_at = NOW()
      WHERE explore_window_started_at IS NOT NULL
        AND explore_window_started_at <= NOW() - ($1 || ' hours')::interval
        AND explore_window_cap IS NOT NULL
        AND explore_window_likes >= explore_window_cap
        AND (
          explore_window_notified_at IS NULL
          OR explore_window_notified_at < explore_window_started_at
        )
      RETURNING user_id`,
    [String(EXPLORE_WINDOW_HOURS)]
  );

  for (const row of result.rows) {
    notifyExploreRefreshed(row.user_id).catch((err) =>
      console.error('notifyExploreRefreshed failed', row.user_id, err)
    );
  }
  return result.rows.length;
};

export const runLimitResetSweep = async (): Promise<{ likes: number; explore: number }> => {
  const [likes, explore] = await Promise.all([sweepLikeResets(), sweepExploreWindows()]);
  return { likes, explore };
};

/**
 * In-process fallback. Cloud Run scales to zero, so this only fires while an
 * instance happens to be warm; the same sweep is exposed as an endpoint for
 * Cloud Scheduler, which is what makes it dependable.
 */
export const startLimitResetTimer = (intervalMinutes = 15): NodeJS.Timeout => {
  const timer = setInterval(() => {
    runLimitResetSweep().catch((err) => console.error('Limit reset sweep failed', err));
  }, intervalMinutes * 60 * 1000);
  // Never hold the process open for this.
  timer.unref?.();
  return timer;
};
