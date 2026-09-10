-- Stops the first limit-reset sweep from announcing history.
--
-- The sweep in limitResets.service notifies anyone whose like window has
-- elapsed and who had hit their limit. On the deploy that introduces it, every
-- existing row qualifies: counters are stale and nothing has ever been marked
-- as notified, so the first run would push "your likes are back" to a crowd of
-- people about resets that happened before the feature existed.
--
-- Marking the current window as already announced means only resets that
-- happen from here on notify. Runs before the server accepts traffic, so it
-- always beats the first sweep.
UPDATE user_activity_limits
   SET likes_reset_notified_at = NOW()
 WHERE likes_reset_notified_at IS NULL;

UPDATE user_activity_limits
   SET explore_window_notified_at = NOW()
 WHERE explore_window_notified_at IS NULL
   AND explore_window_started_at IS NOT NULL;
