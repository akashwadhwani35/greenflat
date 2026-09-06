-- Round-7 feedback: "Hide distance" and "Hide city" must be OFF by default.
--
-- The column defaults were already FALSE, but test accounts created through
-- older builds and the bulk seeder had them on, and the privacy screen showed
-- them lit on first open. Same reasoning as 022: everything on the platform is
-- still a pre-launch account, so a one-time reset is safe. Do not repeat this
-- pattern once real users exist.
UPDATE user_privacy_settings SET hide_distance = FALSE, hide_city = FALSE, updated_at = NOW()
WHERE hide_distance = TRUE OR hide_city = TRUE;

UPDATE users SET hide_distance = FALSE, hide_city = FALSE
WHERE hide_distance = TRUE OR hide_city = TRUE;
