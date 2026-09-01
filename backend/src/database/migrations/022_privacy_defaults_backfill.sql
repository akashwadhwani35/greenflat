-- Bring existing accounts in line with the new privacy defaults.
--
-- 021 changed the column default for show_online_status to FALSE, which only
-- affects rows created afterwards. Every account in the database at this point
-- is a demo or test account created before launch, so flipping them is
-- harmless and makes the test builds reflect what a real signup will see.
-- Do NOT re-run this pattern once real users exist: it would override a
-- setting they chose.
UPDATE user_privacy_settings SET show_online_status = FALSE WHERE show_online_status = TRUE;
UPDATE users SET show_online_status = FALSE WHERE show_online_status = TRUE;
